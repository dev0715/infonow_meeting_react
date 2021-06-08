import React from 'react'
import soundCalling from '../../res/calling.ogg';
import soundCallStarted from '../../res/call-started.ogg';
import soundCallEnded from '../../res/call-ended.ogg';

export default function ApplicationSounds() {
    return (
        <div id="sounds" style={{ display: 'none' }}>
            <audio id="sound-call-started" preload="auto">
                <source src={soundCallStarted} type="audio/ogg" />
            </audio>
            <audio id="sound-calling" preload="auto">
                <source src={soundCalling} type="audio/ogg" />
            </audio>
            <audio id="sound-call-ended" preload="auto">
                <source src={soundCallEnded} type="audio/ogg" />
            </audio>
        </div>
    )
}
