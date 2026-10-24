using System;
using System.Globalization;
using System.IO;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

class FreePadApoBridge {
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern IntPtr OpenFileMapping(uint dwDesiredAccess, bool bInheritHandle, string lpName);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr MapViewOfFile(IntPtr hFileMappingObject, uint dwDesiredAccess, uint dwFileOffsetHigh, uint dwFileOffsetLow, UIntPtr dwNumberOfBytesToMap);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool UnmapViewOfFile(IntPtr lpBaseAddress);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern IntPtr OpenEvent(uint dwDesiredAccess, bool bInheritHandle, string lpName);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool SetEvent(IntPtr hEvent);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern uint WaitForSingleObject(IntPtr hHandle, uint dwMilliseconds);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool CloseHandle(IntPtr hObject);

    // ==========================================
    // WASAPI COM INTERFACES FOR DIRECT LOOPBACK
    // ==========================================
    [ComImport]
    [Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    class MMDeviceEnumeratorComObject { }

    [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDeviceEnumerator {
        [PreserveSig]
        int EnumAudioEndpoints(int dataFlow, int dwStateMask, out IntPtr ppDevices);
        [PreserveSig]
        int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppDevice);
    }

    [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDevice {
        [PreserveSig]
        int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
        [PreserveSig]
        int OpenPropertyStore(int stgmAccess, out IntPtr ppProperties);
        [PreserveSig]
        int GetId([MarshalAs(UnmanagedType.LPWStr)] out string ppstrId);
    }

    [Guid("1CB9AD4C-DBFA-4c32-B178-C2F568A703B2"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioClient {
        [PreserveSig]
        int Initialize(int shareMode, int streamFlags, long hnsBufferDuration, long hnsPeriodicity, IntPtr pFormat, ref Guid audioSessionGuid);
        [PreserveSig]
        int GetBufferSize(out uint pNumBufferFrames);
        [PreserveSig]
        int GetStreamLatency(out long phnsLatency);
        [PreserveSig]
        int GetCurrentPadding(out uint pNumPaddingFrames);
        [PreserveSig]
        int IsFormatSupported(int shareMode, IntPtr pFormat, out IntPtr ppClosestMatch);
        [PreserveSig]
        int GetMixFormat(out IntPtr ppDeviceFormat);
        [PreserveSig]
        int GetDevicePeriod(out long phnsDefaultDevicePeriod, out long phnsMinimumDevicePeriod);
        [PreserveSig]
        int Start();
        [PreserveSig]
        int Stop();
        [PreserveSig]
        int Reset();
        [PreserveSig]
        int SetEventHandle(IntPtr eventHandle);
        [PreserveSig]
        int GetService([In, MarshalAs(UnmanagedType.LPStruct)] Guid riid, [MarshalAs(UnmanagedType.IUnknown)] out object ppv);
    }

    [Guid("C8ADBD64-E71E-48A0-A4DE-185C395CD317"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioCaptureClient {
        [PreserveSig]
        int GetBuffer(out IntPtr ppData, out uint pNumFramesToRead, out uint pdwFlags, out ulong pu64DevicePosition, out ulong pu64QPCPosition);
        [PreserveSig]
        int ReleaseBuffer(uint numFramesRead);
        [PreserveSig]
        int GetNextPacketSize(out uint pNumFramesInNextPacket);
    }

    const string PIPE_NAME = "freepad_apo";
    const int CHUNK_SIZE = 16 * 1024; // 16 KB = 4096 float samples = 85.33ms at 48kHz mono
    const int MAP_SIZE = 0x40034;

    class ApoSlot {
        public string Name;
        public IntPtr hMap;
        public IntPtr pView;
        public IntPtr hCallback;
        public IntPtr hControlCallback;
        public IntPtr hStopCallback;
        public int Channels = 1;
        public int SampleRate = 48000;
    }

    static System.Collections.Generic.List<ApoSlot> activeSlots = new System.Collections.Generic.List<ApoSlot>();
    static IntPtr hMap = IntPtr.Zero;
    static IntPtr pView = IntPtr.Zero;
    static IntPtr hCallback = IntPtr.Zero;
    static IntPtr hControlCallback = IntPtr.Zero;
    static IntPtr hStopCallback = IntPtr.Zero;
    static string foundMapName = "";
    static int apoChannels = 1;
    static int apoSampleRate = 48000;
    static volatile int currentSessionId = 0;
    static readonly object pcmLock = new object();

    // ==========================================
    // WASAPI INSTANT REPLAY BUFFER (30 SECONDS)
    // ==========================================
    static float[] replayRingL = null;
    static float[] replayRingR = null;
    static int replayCapacity = 0;
    static int replayWritePos = 0;
    static long replayTotalFrames = 0;
    static int replaySampleRate = 44100;
    static int replayChannels = 2;
    static volatile bool isReplayRunning = false;
    static Thread replayThread = null;
    static readonly object replayLock = new object();

    static string logFile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "FreePad", "apo_bridge.log");

    static void SafeLog(string msg) {
        try {
            Console.WriteLine(msg);
            string dir = Path.GetDirectoryName(logFile);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir)) {
                Directory.CreateDirectory(dir);
            }
            File.AppendAllText(logFile, DateTime.Now.ToString("s") + " " + msg + Environment.NewLine);
        } catch {}
    }

    static bool InitApo(bool forceScan = false) {
        // If we already have slots and not forcing full rescan, verify at least one is still alive
        if (!forceScan && activeSlots.Count > 0) {
            bool anyAlive = false;
            for (int i = activeSlots.Count - 1; i >= 0; i--) {
                IntPtr testHandle = OpenFileMapping(0x0002 | 0x0004, false, activeSlots[i].Name);
                if (testHandle != IntPtr.Zero) {
                    CloseHandle(testHandle);
                    anyAlive = true;
                } else {
                    // Mapping object was closed by audiodg (e.g. microphone stream closed or changed)
                    try {
                        if (activeSlots[i].pView != IntPtr.Zero) UnmapViewOfFile(activeSlots[i].pView);
                        if (activeSlots[i].hMap != IntPtr.Zero) CloseHandle(activeSlots[i].hMap);
                        if (activeSlots[i].hCallback != IntPtr.Zero) CloseHandle(activeSlots[i].hCallback);
                        if (activeSlots[i].hControlCallback != IntPtr.Zero) CloseHandle(activeSlots[i].hControlCallback);
                        if (activeSlots[i].hStopCallback != IntPtr.Zero) CloseHandle(activeSlots[i].hStopCallback);
                    } catch {}
                    activeSlots.RemoveAt(i);
                }
            }
            if (anyAlive && activeSlots.Count > 0) return true;
        }

        // Clean any dead slots before scanning
        for (int i = activeSlots.Count - 1; i >= 0; i--) {
            IntPtr testHandle = OpenFileMapping(0x0002 | 0x0004, false, activeSlots[i].Name);
            if (testHandle != IntPtr.Zero) {
                CloseHandle(testHandle);
            } else {
                try {
                    if (activeSlots[i].pView != IntPtr.Zero) UnmapViewOfFile(activeSlots[i].pView);
                    if (activeSlots[i].hMap != IntPtr.Zero) CloseHandle(activeSlots[i].hMap);
                    if (activeSlots[i].hCallback != IntPtr.Zero) CloseHandle(activeSlots[i].hCallback);
                    if (activeSlots[i].hControlCallback != IntPtr.Zero) CloseHandle(activeSlots[i].hControlCallback);
                    if (activeSlots[i].hStopCallback != IntPtr.Zero) CloseHandle(activeSlots[i].hStopCallback);
                } catch {}
                activeSlots.RemoveAt(i);
            }
        }

        string[] suffixes = new string[] { "0", "1", "2", "3", "4", "5", "6", "7", "", "_0", "_1", "_2" };
        foreach (string s in suffixes) {
            string mapName = "Global\\UniteFxMappingObject1.8.0" + s;
            bool alreadyBound = false;
            for (int j = 0; j < activeSlots.Count; j++) {
                if (activeSlots[j].Name == mapName) { alreadyBound = true; break; }
            }
            if (alreadyBound) continue;

            IntPtr curMap = OpenFileMapping(0x0002 | 0x0004, false, mapName);
            if (curMap != IntPtr.Zero) {
                string cbName = "Global\\UniteFxCallback1.8.0" + s;
                string ccbName = "Global\\UniteFxControlCallback1.8.0" + s;
                string stopName = "Global\\UniteFxStopCallback1.8.0" + s;

                IntPtr cb = OpenEvent(0x0002, false, cbName);
                if (cb == IntPtr.Zero) cb = OpenEvent(0x0002 | 0x00100000, false, cbName);

                IntPtr ccb = OpenEvent(0x0002 | 0x00100000, false, ccbName);
                if (ccb == IntPtr.Zero) ccb = OpenEvent(0x0002, false, ccbName);

                IntPtr stopCb = OpenEvent(0x0002, false, stopName);

                IntPtr curView = MapViewOfFile(curMap, 0x0002 | 0x0004, 0, 0, new UIntPtr(MAP_SIZE));
                if (curView != IntPtr.Zero) {
                    var slot = new ApoSlot {
                        Name = mapName,
                        hMap = curMap,
                        pView = curView,
                        hCallback = cb,
                        hControlCallback = ccb,
                        hStopCallback = stopCb
                    };

                    int ch = Marshal.ReadInt32(curView, 20);
                    if (ch >= 1 && ch <= 8) slot.Channels = ch;

                    byte[] srBytes = new byte[4];
                    Marshal.Copy(new IntPtr(curView.ToInt64() + 32), srBytes, 0, 4);
                    float sr = BitConverter.ToSingle(srBytes, 0);
                    if (sr >= 8000 && sr <= 192000) slot.SampleRate = (int)sr;

                    activeSlots.Add(slot);
                    SafeLog("[FreePadApoBridge] Bound to " + mapName + " (SR=" + slot.SampleRate + ", CH=" + slot.Channels + ")");
                } else {
                    CloseHandle(curMap);
                }
            }
        }

        if (activeSlots.Count > 0) {
            hMap = activeSlots[0].hMap;
            pView = activeSlots[0].pView;
            hCallback = activeSlots[0].hCallback;
            hControlCallback = activeSlots[0].hControlCallback;
            hStopCallback = activeSlots[0].hStopCallback;
            apoSampleRate = activeSlots[0].SampleRate;
            apoChannels = activeSlots[0].Channels;
            foundMapName = activeSlots[0].Name + " (Total active slots: " + activeSlots.Count + ")";
            return true;
        }

        return false;
    }

    static void StopPlayback() {
        Interlocked.Increment(ref currentSessionId);
        for (int i = 0; i < activeSlots.Count; i++) {
            var slot = activeSlots[i];
            if (slot.hStopCallback != IntPtr.Zero) SetEvent(slot.hStopCallback);
            if (slot.pView != IntPtr.Zero) {
                Marshal.WriteInt32(slot.pView, 0x2C, 0);
                Marshal.WriteInt32(slot.pView, 0x30, 0);
            }
            if (slot.hCallback != IntPtr.Zero) SetEvent(slot.hCallback);
        }
    }

    static bool StreamPcmBytes(byte[] rawBytes, int sessionId) {
        if (!InitApo(true)) {
            for (int r = 0; r < 5 && activeSlots.Count == 0; r++) {
                Thread.Sleep(100);
                InitApo(true);
            }
            if (activeSlots.Count == 0) return false;
        }

        int bytesSent = 0;
        int total = rawBytes.Length;
        int bytesPerSec = Math.Max(1, apoSampleRate * apoChannels * 4);
        System.Diagnostics.Stopwatch sw = new System.Diagnostics.Stopwatch();

        while (bytesSent < total && sessionId == currentSessionId) {
            int toSend = Math.Min(CHUNK_SIZE, total - bytesSent);
            double chunkSec = (double)toSend / bytesPerSec;
            int chunkExpectedMs = (int)(chunkSec * 1000.0);

            sw.Restart();

            // Send chunk to all active slots
            for (int i = 0; i < activeSlots.Count; i++) {
                var slot = activeSlots[i];
                try {
                    Marshal.Copy(rawBytes, bytesSent, new IntPtr(slot.pView.ToInt64() + 0x34), toSend);
                    Marshal.WriteInt32(slot.pView, 0x30, toSend);
                    Marshal.WriteInt32(slot.pView, 0x2C, 1);
                    if (slot.hCallback != IntPtr.Zero) SetEvent(slot.hCallback);
                } catch {}
            }

            bytesSent += toSend;

            // Wait for at least one active slot to consume the audio (0x2C transitions to 0)
            int maxWaitMs = Math.Max(25, chunkExpectedMs + 35);
            while (sessionId == currentSessionId && sw.ElapsedMilliseconds < maxWaitMs) {
                bool anyConsumed = false;
                for (int i = 0; i < activeSlots.Count; i++) {
                    try {
                        if (Marshal.ReadInt32(activeSlots[i].pView, 0x2C) == 0) {
                            anyConsumed = true;
                            break;
                        }
                    } catch {}
                }
                if (anyConsumed) break;
                Thread.Sleep(2);
            }

            // Real-time pacing: ensure audio stream never rushes faster than real time
            long elapsed = sw.ElapsedMilliseconds;
            if (elapsed < chunkExpectedMs && sessionId == currentSessionId) {
                int sleepRest = (int)(chunkExpectedMs - elapsed);
                if (sleepRest > 0) Thread.Sleep(sleepRest);
            }
        }

        // Final cleanup
        for (int i = 0; i < activeSlots.Count; i++) {
            try {
                if (activeSlots[i].hCallback != IntPtr.Zero) SetEvent(activeSlots[i].hCallback);
            } catch {}
        }

        return sessionId == currentSessionId;
    }

    // ==========================================
    // WASAPI DIRECT SYSTEM & DISCORD RECORDER
    // ==========================================
    static void StartWasapiReplay() {
        lock (replayLock) {
            if (isReplayRunning) return;
            isReplayRunning = true;
            replayThread = new Thread(WasapiLoopbackWorker) {
                IsBackground = true,
                Name = "FreePadWasapiLoopback"
            };
            replayThread.Start();
        }
    }

    static void StopWasapiReplay() {
        lock (replayLock) {
            isReplayRunning = false;
        }
    }

    static void WasapiLoopbackWorker() {
        SafeLog("[FreePadLoopback] Worker starting...");
        while (isReplayRunning) {
            try {
                var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumeratorComObject();
                IMMDevice device;
                int hr = enumerator.GetDefaultAudioEndpoint(0 /* eRender */, 0 /* eConsole */, out device);
                if (hr != 0 || device == null) {
                    SafeLog("[FreePadLoopback] GetDefaultAudioEndpoint error 0x" + hr.ToString("X"));
                    Thread.Sleep(2000);
                    continue;
                }

                Guid iidAudioClient = new Guid("1CB9AD4C-DBFA-4c32-B178-C2F568A703B2");
                object clientObj;
                hr = device.Activate(ref iidAudioClient, 1, IntPtr.Zero, out clientObj);
                if (hr != 0 || clientObj == null) {
                    SafeLog("[FreePadLoopback] Activate IAudioClient error 0x" + hr.ToString("X"));
                    Thread.Sleep(2000);
                    continue;
                }

                var audioClient = (IAudioClient)clientObj;
                IntPtr pMixFormat;
                audioClient.GetMixFormat(out pMixFormat);

                short ch = Marshal.ReadInt16(pMixFormat, 2);
                int sr = Marshal.ReadInt32(pMixFormat, 4);
                short bits = Marshal.ReadInt16(pMixFormat, 14);

                replayChannels = ch;
                replaySampleRate = sr;

                int bufferSeconds = 30;
                replayCapacity = sr * bufferSeconds;
                replayRingL = new float[replayCapacity];
                replayRingR = new float[replayCapacity];
                replayWritePos = 0;
                replayTotalFrames = 0;

                SafeLog(string.Format("[FreePadLoopback] Initializing WASAPI (CH={0}, SR={1}, Bits={2})...", ch, sr, bits));

                Guid sessionGuid = Guid.Empty;
                hr = audioClient.Initialize(0 /* SHARED */, 0x00020000 /* AUDCLNT_STREAMFLAGS_LOOPBACK */, 10000000 /* 1s */, 0, pMixFormat, ref sessionGuid);
                if (hr != 0) {
                    SafeLog("[FreePadLoopback] Initialize error 0x" + hr.ToString("X"));
                    Thread.Sleep(2000);
                    continue;
                }

                Guid iidCapture = new Guid("C8ADBD64-E71E-48A0-A4DE-185C395CD317");
                object captureObj;
                hr = audioClient.GetService(iidCapture, out captureObj);
                if (hr != 0 || captureObj == null) {
                    SafeLog("[FreePadLoopback] GetService IAudioCaptureClient error 0x" + hr.ToString("X"));
                    Thread.Sleep(2000);
                    continue;
                }

                var capture = (IAudioCaptureClient)captureObj;
                hr = audioClient.Start();
                if (hr != 0) {
                    SafeLog("[FreePadLoopback] audioClient.Start error 0x" + hr.ToString("X"));
                    Thread.Sleep(2000);
                    continue;
                }

                SafeLog("[FreePadLoopback] Actively recording rolling 30s buffer!");

                while (isReplayRunning) {
                    uint packetSize;
                    hr = capture.GetNextPacketSize(out packetSize);
                    if (hr != 0 || packetSize == 0) {
                        Thread.Sleep(8);
                        continue;
                    }

                    IntPtr pData;
                    uint numFrames;
                    uint flags;
                    ulong devPos, qpcPos;
                    hr = capture.GetBuffer(out pData, out numFrames, out flags, out devPos, out qpcPos);
                    if (hr == 0 && pData != IntPtr.Zero) {
                        bool isSilent = (flags & 1) != 0;

                        unsafe {
                            float* pFloat = (float*)pData.ToPointer();
                            for (uint i = 0; i < numFrames; i++) {
                                float valL = 0f;
                                float valR = 0f;

                                if (!isSilent) {
                                    if (ch == 8) {
                                        float c0 = pFloat[i * 8 + 0];
                                        float c1 = pFloat[i * 8 + 1];
                                        float c2 = pFloat[i * 8 + 2];
                                        float c4 = pFloat[i * 8 + 4];
                                        float c5 = pFloat[i * 8 + 5];
                                        float c6 = pFloat[i * 8 + 6];
                                        float c7 = pFloat[i * 8 + 7];
                                        valL = (c0 + 0.707f * c2 + 0.707f * c4 + 0.707f * c6) * 0.75f;
                                        valR = (c1 + 0.707f * c2 + 0.707f * c5 + 0.707f * c7) * 0.75f;
                                    } else if (ch == 2) {
                                        valL = pFloat[i * 2 + 0];
                                        valR = pFloat[i * 2 + 1];
                                    } else {
                                        valL = pFloat[i];
                                        valR = pFloat[i];
                                    }
                                }

                                replayRingL[replayWritePos] = valL;
                                replayRingR[replayWritePos] = valR;
                                replayWritePos = (replayWritePos + 1) % replayCapacity;
                                replayTotalFrames++;
                            }
                        }

                        capture.ReleaseBuffer(numFrames);
                    }
                }

                audioClient.Stop();
                SafeLog("[FreePadLoopback] Worker stopped.");
            } catch (Exception ex) {
                SafeLog("[FreePadLoopback] Worker error: " + ex.Message);
                Thread.Sleep(2000);
            }
        }
    }

    static bool ClipReplayToWav(int seconds, string outWavPath) {
        lock (replayLock) {
            if (!isReplayRunning || replayRingL == null || replayTotalFrames == 0) {
                SafeLog("[FreePadLoopback] Clip error: Loopback not running or no frames yet");
                return false;
            }

            try {
                int sampleRate = replaySampleRate > 0 ? replaySampleRate : 44100;
                int requestedFrames = sampleRate * seconds;
                int framesToExtract = (int)Math.Min((long)requestedFrames, Math.Min(replayTotalFrames, (long)replayCapacity));

                if (framesToExtract < sampleRate / 2) {
                    SafeLog("[FreePadLoopback] Clip error: Less than 0.5s of audio available");
                    return false;
                }

                float[] sliceL = new float[framesToExtract];
                float[] sliceR = new float[framesToExtract];

                int readPos = (replayWritePos - framesToExtract + replayCapacity) % replayCapacity;
                float peak = 0f;

                for (int i = 0; i < framesToExtract; i++) {
                    float sL = replayRingL[readPos];
                    float sR = replayRingR[readPos];
                    sliceL[i] = sL;
                    sliceR[i] = sR;

                    float absL = Math.Abs(sL);
                    float absR = Math.Abs(sR);
                    if (absL > peak) peak = absL;
                    if (absR > peak) peak = absR;

                    readPos = (readPos + 1) % replayCapacity;
                }

                // Volume boost if the speech in Discord is quiet
                float gain = 1.0f;
                if (peak > 0.02f && peak < 0.85f) {
                    gain = Math.Min(2.5f, 0.92f / peak);
                }

                string dir = Path.GetDirectoryName(outWavPath);
                if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);

                using (FileStream fs = new FileStream(outWavPath, FileMode.Create, FileAccess.Write))
                using (BinaryWriter bw = new BinaryWriter(fs)) {
                    int numChannels = 2;
                    int bitsPerSample = 16;
                    short blockAlign = (short)(numChannels * (bitsPerSample / 8));
                    int byteRate = sampleRate * blockAlign;
                    int dataSize = framesToExtract * blockAlign;

                    bw.Write(Encoding.ASCII.GetBytes("RIFF"));
                    bw.Write(36 + dataSize);
                    bw.Write(Encoding.ASCII.GetBytes("WAVE"));

                    bw.Write(Encoding.ASCII.GetBytes("fmt "));
                    bw.Write(16);
                    bw.Write((short)1); // PCM
                    bw.Write((short)numChannels);
                    bw.Write(sampleRate);
                    bw.Write(byteRate);
                    bw.Write(blockAlign);
                    bw.Write((short)bitsPerSample);

                    bw.Write(Encoding.ASCII.GetBytes("data"));
                    bw.Write(dataSize);

                    for (int i = 0; i < framesToExtract; i++) {
                        float l = Math.Max(-1.0f, Math.Min(1.0f, sliceL[i] * gain));
                        float r = Math.Max(-1.0f, Math.Min(1.0f, sliceR[i] * gain));

                        short pcmL = (short)(l < 0 ? l * 32768f : l * 32767f);
                        short pcmR = (short)(r < 0 ? r * 32768f : r * 32767f);

                        bw.Write(pcmL);
                        bw.Write(pcmR);
                    }
                }

                SafeLog("[FreePadLoopback] Saved " + seconds + "s clip to " + outWavPath + " (" + new FileInfo(outWavPath).Length + " bytes)");
                return true;
            } catch (Exception ex) {
                SafeLog("[FreePadLoopback] Clip exception: " + ex.Message);
                return false;
            }
        }
    }

    static void HandleClient(object state) {
        NamedPipeServerStream server = (NamedPipeServerStream)state;
        try {
            using (StreamReader reader = new StreamReader(server, new UTF8Encoding(false)))
            using (StreamWriter writer = new StreamWriter(server, new UTF8Encoding(false)) { AutoFlush = true }) {
                while (server.IsConnected) {
                    string line = reader.ReadLine();
                    if (line == null) break;

                    line = line.Trim();
                    if (line == "PING") {
                        writer.WriteLine("PONG");
                    }
                    else if (line == "STATUS") {
                        bool ok = InitApo(true);
                        string json = string.Format(
                            "{{\"active\":{0},\"mapping\":\"{1}\",\"sampleRate\":{2},\"channels\":{3},\"slots\":{4}}}",
                            ok ? "true" : "false",
                            foundMapName.Replace("\\", "\\\\"),
                            apoSampleRate,
                            apoChannels,
                            activeSlots.Count
                        );
                        writer.WriteLine(json);
                    }
                    else if (line == "STOP") {
                        StopPlayback();
                        writer.WriteLine("STOPPED");
                    }
                    else if (line == "START_REPLAY") {
                        StartWasapiReplay();
                        writer.WriteLine("REPLAY_STARTED");
                    }
                    else if (line == "STOP_REPLAY") {
                        StopWasapiReplay();
                        writer.WriteLine("REPLAY_STOPPED");
                    }
                    else if (line == "STATUS_REPLAY") {
                        double bufferedSec = (isReplayRunning && replaySampleRate > 0)
                            ? (double)Math.Min(replayTotalFrames, (long)replayCapacity) / replaySampleRate
                            : 0.0;
                        string json = string.Format(
                            "{{\"active\":{0},\"buffered\":{1:0.0},\"sampleRate\":{2},\"channels\":{3}}}",
                            isReplayRunning ? "true" : "false",
                            bufferedSec.ToString("0.0", CultureInfo.InvariantCulture),
                            replaySampleRate,
                            replayChannels
                        );
                        writer.WriteLine(json);
                    }
                    else if (line.StartsWith("CLIP_REPLAY ")) {
                        // Format: CLIP_REPLAY <seconds> <outputFilePath>
                        string[] parts = line.Substring(12).Split(new char[] { ' ' }, 2);
                        int sec = int.Parse(parts[0]);
                        string outPath = parts[1].Trim();

                        bool ok = ClipReplayToWav(sec, outPath);
                        writer.WriteLine(ok ? "CLIP_OK " + outPath : "CLIP_FAILED");
                    }
                    else if (line.StartsWith("PLAY_PCM ")) {
                        int pcmLength = int.Parse(line.Substring(9).Trim());
                        byte[] pcmData = new byte[pcmLength];
                        int readTotal = 0;
                        while (readTotal < pcmLength) {
                            int r = server.Read(pcmData, readTotal, pcmLength - readTotal);
                            if (r <= 0) break;
                            readTotal += r;
                        }

                        int mySessionId = Interlocked.Increment(ref currentSessionId);
                        if (hCallback != IntPtr.Zero) SetEvent(hCallback);

                        lock (pcmLock) {
                            if (mySessionId != currentSessionId) {
                                writer.WriteLine("INTERRUPTED");
                                return;
                            }

                            if (pView != IntPtr.Zero) {
                                Marshal.WriteInt32(pView, 0x2C, 0);
                                Marshal.WriteInt32(pView, 0x30, 0);
                            }

                            bool res = StreamPcmBytes(pcmData, mySessionId);
                            writer.WriteLine(res ? "DONE" : "INTERRUPTED");
                        }
                    }
                    else if (line == "EXIT") {
                        writer.WriteLine("BYE");
                        Environment.Exit(0);
                        return;
                    }
                    else {
                        writer.WriteLine("UNKNOWN_CMD");
                    }
                }
            }
        } catch (Exception ex) {
            SafeLog("[FreePadApoBridge] Client handler exception: " + ex.Message);
        } finally {
            try {
                if (server.IsConnected) server.Disconnect();
            } catch {}
            try { server.Dispose(); } catch {}
        }
    }

    static void RunPipeServer() {
        SafeLog("[FreePadApoBridge] Multi-client Pipe Server listening on \\\\.\\pipe\\" + PIPE_NAME);
        InitApo();

        // Auto-start WASAPI loopback capture immediately so it's always ready!
        StartWasapiReplay();

        while (true) {
            try {
                NamedPipeServerStream server = new NamedPipeServerStream(
                    PIPE_NAME,
                    PipeDirection.InOut,
                    NamedPipeServerStream.MaxAllowedServerInstances,
                    PipeTransmissionMode.Byte,
                    PipeOptions.Asynchronous);

                server.WaitForConnection();
                ThreadPool.QueueUserWorkItem(HandleClient, server);
            } catch (Exception ex) {
                SafeLog("[FreePadApoBridge] Server loop exception: " + ex.Message);
                Thread.Sleep(100);
            }
        }
    }

    static void PlayTestTone(double durationSec, double freq) {
        if (!InitApo()) {
            SafeLog("Failed to initialize APO!");
            return;
        }

        int totalFrames = (int)(apoSampleRate * durationSec);
        float[] samples = new float[totalFrames * apoChannels];
        for (int i = 0; i < totalFrames; i++) {
            float val = (float)(Math.Sin(2.0 * Math.PI * freq * i / apoSampleRate) * 0.75);
            for (int ch = 0; ch < apoChannels; ch++) {
                samples[i * apoChannels + ch] = val;
            }
        }

        byte[] rawBytes = new byte[samples.Length * 4];
        Buffer.BlockCopy(samples, 0, rawBytes, 0, rawBytes.Length);

        SafeLog("Injecting " + durationSec + "s " + freq + "Hz tone (" + rawBytes.Length + " bytes)...");
        int mySessionId = Interlocked.Increment(ref currentSessionId);
        bool ok = false;
        lock (pcmLock) {
            ok = StreamPcmBytes(rawBytes, mySessionId);
        }
        SafeLog("Injection " + (ok ? "completed successfully!" : "stopped."));
    }

    static void Main(string[] args) {
        AppDomain.CurrentDomain.UnhandledException += (s, e) => {
            SafeLog("[FreePadApoBridge] UnhandledException: " + e.ExceptionObject.ToString());
        };

        if (args.Length > 0 && args[0] == "status") {
            bool ok = InitApo();
            SafeLog(string.Format("APO Active: {0}, Mapping: {1}, SampleRate: {2}, Channels: {3}",
                ok, foundMapName, apoSampleRate, apoChannels));
            return;
        }

        if (args.Length > 0 && args[0] == "tone") {
            double dur = args.Length > 1 ? double.Parse(args[1].Replace(',', '.'), CultureInfo.InvariantCulture) : 1.0;
            double freq = args.Length > 2 ? double.Parse(args[2].Replace(',', '.'), CultureInfo.InvariantCulture) : 440.0;
            PlayTestTone(dur, freq);
            return;
        }

        RunPipeServer();
    }
}
