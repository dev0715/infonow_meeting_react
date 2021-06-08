import React from 'react'
import PropTypes from 'prop-types'

export default function Whiteboard(props) {
    return (
        <>
            {
                props.visible &&
                <div className="whiteBoardContainer">
                    <button onClick={props.onBack}>
                        <img alt="" src={props.backIcon}></img>
                    </button>
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
    onBack: PropTypes.func,
    backIcon: PropTypes.any,
    url: PropTypes.string,
}
