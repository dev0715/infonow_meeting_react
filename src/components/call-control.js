import React from 'react'
import PropTypes from 'prop-types'

export default function CallControl(props) {
    return (
        <>
            {
                props.visible &&
                <>
                    <button
                        id={props.id}
                        className={`operation-btn ${props.className}`}
                        onClick={props.onClick}
                        disabled={props.disabled}
                    >
                        <img alt="" src={props.icon} />
                    </button>
                    {props.children}
                </>
            }

        </>
    )
}


CallControl.propTypes = {
    visible: PropTypes.bool,
    id: PropTypes.string,
    onClick: PropTypes.func,
    icon: PropTypes.any,
    disabled: PropTypes.bool
}