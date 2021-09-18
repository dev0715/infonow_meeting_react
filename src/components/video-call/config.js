

export const servers = {
    iceServers: [
      {
        urls: [
          'stun:stun.l.google.com:19302',
          'stun:global.stun.twilio.com:3478'
        ]
      }
    ],
    sdpSemantics: 'unified-plan'
  };

export const IOConfig = {
    // "transports": ["websocket", "flashsocket", "pooling"],
    "path": "/live/socket.io",
    "reconnection": true,
    "reconnectionDelay": 300, //Make the xhr connections as fast as possible
    "timeout": 1000 * 60 * 20 // Timeout after 20 minutes 
}

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
    },

};

export const AudioSharingConfig = {

    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 8,
    },
};

export const ScreenSharingConfig = {
    logicalSurface: false,
    video: {
        cursor: "always" | "motion" | "never",
        displaySurface: "application" | "browser" | "monitor" | "window",
    }
};


export const Browsers = {
    Opera: 'Opera',
    Chrome: 'Chrome',
    Safari: 'Safari',
    Firefox: 'Firefox',
    MSIE: 'MSIE'
}