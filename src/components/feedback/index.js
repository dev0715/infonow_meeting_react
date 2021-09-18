import React from 'react'
import PropTypes from 'prop-types';
import { useState } from 'react';

import { toast } from '../../utils';
import StarRatings from 'react-star-ratings';
import { URLs } from '../video-call/urls';

const icTimes = require('../../images/times.svg').default;

export default function Feedback(props) {

    const [rating, setRating] = useState(5)
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)

    const submitFeedback = async () => {
        if (!rating) return toast("Rating is required")
        setLoading(true)

        let data = {
            rating,
            meetingId: props.meetingId
        }

        if (message) data.message = message
        try {
            let response = await fetch(URLs.feedback, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'authorization': decodeURIComponent(props.token)
                },
                body: JSON.stringify(data)
            })
            // console.log("Feedback_Response", response)
            setLoading(false)
            if (response.status == 200) {
                let json = await response.json()
                if (json.status != 200)
                    return toast(json.message)
                toast("Thank you for your feedback")
                props.onClose()
            } else {
                throw "Request failed"
            }
        } catch (error) {
            // console.log("FeedbackError", error)
            toast("Something went wrong")
        }
    }



    const closeFeedback = () => {
        setRating(5)
        setMessage('')
        props.onClose()
    }

    return (
        <>{
            props.isFeedback &&
            <div
                className='model'
                style={{ display: "flex" }}
            >
                <div className='model-body'>
                    <div className="model-header">
                        <button className="btn-close">
                            <img alt="" src={icTimes} onClick={() => closeFeedback()} />
                        </button>
                        <h3>How was your experience?</h3>
                    </div>
                    <div className="model-content">
                        <div className="rating-container mb-2">
                            <StarRatings
                                rating={rating}
                                changeRating={(r, name) => setRating(r)}
                                starRatedColor="purple"
                                numberOfStars={5}
                                starDimension="32px"
                                starSpacing="8px"
                            />
                        </div>

                        <div className="form-group">
                            <label >Feedback</label>
                            <textarea
                                className="form-control-input"
                                placeholder={`Describe your interaction with your ${props.userType == 'student' ? 'teacher' : 'student'}...`}
                                rows={5}
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                disabled={loading}
                            />
                        </div>
                        <button
                            className="submit-btn"
                            onClick={() => submitFeedback()}
                            disabled={loading}
                        >
                            {
                                loading ? "Submitting..." : "Submit"
                            }
                        </button>
                    </div>
                </div>
            </div>
        }
        </>
    )
}


Feedback.propTypes = {
    isFeedback: PropTypes.bool,
    userType: PropTypes.string,
    meetingId: PropTypes.string,
    token: PropTypes.string,
    onClose: PropTypes.func
}
