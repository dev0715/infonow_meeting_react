

export const servers = {
    iceServers: [
        {
            urls: [
                "stun:stun1.l.google.com:19302",
                "stun:stun2.l.google.com:19302",
            ],
        },
    ],
    iceCandidatePoolSize: 10,
};

export const IOConfig = { transports: ['websocket', 'polling', 'flashsocket'] }

export const VideoSharingConfig = {
    video: {
        width: {
            min: 640,
            max: 1024,
        },
        height: {
            min: 480,
            max: 768,
        },
    }
};

export const AudioSharingConfig = {

    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 8,
    },
};

export const ScreenSharingConfig = {
    logicalSurface: true,
    video: {
        cursor: "always" | "motion" | "never",
        displaySurface: "application" | "browser" | "monitor" | "window",
    }
};
