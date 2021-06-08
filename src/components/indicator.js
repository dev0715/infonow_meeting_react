import React from 'react'
import PropTypes from 'prop-types'

export default function Indicator(props) {
    return (
        <>
            {
                props.visible &&
                <div>
                    <div>
                        <img alt="" src={props.icon}></img>
                    </div>
                </div>
            }
        </>
    )
}

Indicator.propTypes = {
    visible: PropTypes.bool,
    icon: PropTypes.any
}