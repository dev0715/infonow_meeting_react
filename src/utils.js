
/**
 * 
 * @param {string} name 
 */
export function getNameInitials(name) {
    if (!name) return "";
    if (name.indexOf(' ') > -1) {
        let names = name.split(' ');
        return names[0] + names[1];
    }
    else {
        return name.substr(0, 2);
    }
}

/**
 * 
 * @param {MediaStream} stream 
 */
export function detectAudioLevelOfRemoteStream(audioLevels, stream) {



    if (stream) {
        if (stream.getAudioTracks().length > 0) {
            var audioContext = new AudioContext();
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