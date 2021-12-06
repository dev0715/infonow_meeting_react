
/**
 * 
 * @param {string} name 
 */
export function getNameInitials(name) {
    if (!name) return "";
    let names = name.split(' ');
    if (names.length > 1) {
        return names[0].substr(0, 1) + names[1].substr(0, 1)
    } else {
        return names[0].substr(0, 1)
    }
}

export function getFirstName(name) {
    if (!name) return "";
    let names = name.split(' ');
    if (names.length > 1) {
        return names[0]
    } else {
        return name
    }
}

/**
 * 
 * @param {MediaStream} stream 
 */
export function detectAudioLevelOfRemoteStream(audioLevels, stream) {

    var AudioContext = window.AudioContext // Default
    || window.webkitAudioContext // Safari and old versions of Chrome
    || false; 

    if (AudioContext) {
        let ctx = new AudioContext;
    if (stream) {
        if (stream.getAudioTracks().length > 0) {
            var audioContext = ctx;
            var microphone = audioContext.createMediaStreamSource(stream);
            var javascriptNode = audioContext.createScriptProcessor(1024, 1, 1);

            microphone.connect(javascriptNode);
            javascriptNode.connect(audioContext.destination);
            javascriptNode.addEventListener('audioprocess', function (event) {
                var inpt_L = event.inputBuffer.getChannelData(0);
                var instant_L = 0.0;

                var sum_L = 0.0;
                for (var i = 0; i < inpt_L.length; ++i) {
                    sum_L += inpt_L[i] * inpt_L[i];
                }
                instant_L = Math.sqrt(sum_L / inpt_L.length);
                audioLevels.max_level_L = Math.max(audioLevels.max_level_L, instant_L);
                instant_L = Math.max(instant_L, audioLevels.old_level_L - 0.008);
                audioLevels.old_level_L = instant_L;

                console.log("Audio_Level", instant_L / audioLevels.max_level_L)
            })
        }
    }
} else {
    console.warning("AudioContext is not supported. Sound bubble will not work")
}

    
}

export function audioScale(remoteAudioReading) {
    let scale = 1.0 + (parseFloat(remoteAudioReading) * 20);
    return scale > 1.5 ? 1.5 : scale;
}

export function toast(text) {
    let x = document.getElementById("snackbar");
    x.innerHTML = text
    x.className = "show";

    setTimeout(function () {
        x.className = x.className.replace("show", "");
    }, 3000);
}

/**
 * 
 * @param {MediaDeviceInfo[]} devices 
 */
export function devicesSelectList(devices) {
    return devices.map(d => {
        return { value: d.deviceId, label: d.label }
    })
}


export function playSound(id, loop = false) {
    let audio = document.getElementById(id);
    if (loop) audio.setAttribute("loop", true);
    else audio.removeAttribute("loop");
    audio.play();
}

export function stopSound(id) {
    let audio = document.getElementById(id);
    audio.load();
    audio.pause();
}