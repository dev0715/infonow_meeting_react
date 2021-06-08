import React from 'react'
import PropTypes from 'prop-types'

export default function VideoContainer(props) {
    return (
        <video id={props.containerId}
            ref={props.reference}
            className={props.isActive ? "active" : ""}
            autoPlay={true}
            playsInline
            muted={props.isMuted}
            style={{
                objectFit: 'contain'
            }}
        ></video>
    )
}

VideoContainer.propTypes = {
    containerId: PropTypes.string,
    isActive: PropTypes.bool,
    reference: PropTypes.any,
    isMuted: PropTypes.bool
}
