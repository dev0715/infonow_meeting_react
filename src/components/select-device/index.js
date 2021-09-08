import React from 'react'
import PropTypes from 'prop-types';
import { devicesSelectList } from '../../utils';
import Select from 'react-select'
const icTimes = require('../../images/times.svg').default;

export default function SelectDevice(props) {
    return (
        <>{
            props.visible &&
            <div
                className='model'
                style={{ display: "flex" }}
            >

                <div className='model-body'>
                    <div className="model-header">
                        <button className="btn-close">
                            <img alt="" src={icTimes} onClick={props.onClose} />
                        </button>
                        <h3>{props.title}</h3>
                    </div>
                    <div className="model-content">
                        <Select
                            className="select"
                            placeholder={props.placeholder}
                            options={devicesSelectList(props.devices)}
                            value={devicesSelectList(props.devices).find(x => x.value === props.selectedDevicesId)}
                            onChange={(e) => props.onSelectDevice(e.value)}
                        />
                    </div>
                </div>
            </div>
        }
        </>
    )
}


SelectDevice.propTypes = {
    visible: PropTypes.bool,
    devices: PropTypes.array,
    title: PropTypes.string,
    placeholder: PropTypes.string,
    selectedDevicesId: PropTypes.string,
    onSelectDevice: PropTypes.func,
    onClose: PropTypes.func
}
