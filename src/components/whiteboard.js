import React from 'react'
import PropTypes from 'prop-types'


const icMicSlash = require('../images/mic-slash.svg').default;
const icMic = require('../images/mic.svg').default;

const icVideoSlash = require('../images/video-slash.svg').default;
const icVideo = require('../images/video.svg').default;

export default function Whiteboard(props) {
    return (
        <>
            {
                props.visible &&
                <div className="whiteBoardContainer">
                    <div className="btn-call">
                        <button onClick={props.onBack}>
                            <img alt="" src={props.backIcon}></img>
                        </button>
                        <div className="actions">
                            <button
                                onClick={props.onAudioToggle}
                            >
                                <img src={props.isAudioEnabled ? icMic : icMicSlash} />
                            </button>
                            <button
                                onClick={props.onVideoToggle}
                            >
                                <img src={props.isVideoEnabled ? icVideo : icVideoSlash} />
                            </button>

                        </div>
                    </div>

                    <iframe
                        title="Whiteboard"
                        id="whiteBoard"
                        src={props.url}
                    >
                    </iframe>
                </div>
            }
        </>
    )
}

Whiteboard.propTypes = {
    visible: PropTypes.bool,
    isAudioEnabled: PropTypes.bool,
    isVideoEnabled: PropTypes.bool,
    onAudioToggle: PropTypes.func,
    onVideoToggle: PropTypes.func,
    onBack: PropTypes.func,
    backIcon: PropTypes.any,
    url: PropTypes.string,
}
