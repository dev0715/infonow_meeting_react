import React from 'react'
import PropTypes from 'prop-types'
const icArrowDown = require('../images/arrow-down.svg').default;

export default function SelectDeviceTrigger(props) {
    return (
        <>
            {
                props.visible &&
                <button
                    className="device-selector"
                    onClick={props.onClick}
                >
                    <img alt="" src={icArrowDown} />
                </button>
            }
        </>
    )
}

SelectDeviceTrigger.propTypes = {
    visible: PropTypes.bool,
    onClick: PropTypes.func
}