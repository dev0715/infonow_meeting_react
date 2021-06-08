

import React, { useEffect, useState } from 'react'

import SelectDevice from '../select-device';
import io from "socket.io-client"
import './style.css';
import { IOEvents } from "./events"
import { servers, IOConfig } from './config';
import { useParams } from 'react-router';
import { getWhiteboardUrl, URLs } from './urls';

import {
    getAudioMediaDevices,
    getConnectedDevices,
    getVideoMediaDevices,
    isAudioAvailable,
    isCameraAvailable,
    removeAllAudioTracks,
    removeAllVideoTracks,
    setNewAudioTrack,
    setNewVideoTrack,
    closeStreamsAndResetVideo
} from './stream';
import { audioScale, getNameInitials, playSound, stopSound, toast } from '../../utils';
import { SoundMeter } from './sound-meter'
import ApplicationSounds from '../application-sounds';
import Indicator from '../indicator';
import Whiteboard from '../whiteboard';
import VideoContainer from '../video-container';
import CallControl from '../call-control';
import SelectDeviceTrigger from '../select-device-trigger';

const icBrush = require('../../images/brush.svg').default;
const icMicSlash = require('../../images/mic-slash.svg').default;
const icMic = require('../../images/mic.svg').default;
const icPhoneOff = require('../../images/phone-off.svg').default;
const icPhoneOn = require('../../images/phone-on.svg').default;
const icPortrait = require('../../images/portrait.svg').default;
const icScreenSharingSlash = require('../../images/screensharing-slash.svg').default;
const icScreenSharing = require('../../images/screensharing.svg').default;
const icVideoSlash = require('../../images/video-slash.svg').default;
const icVideo = require('../../images/video.svg').default;
const icLoader = require('../../images/loader.png').default;
const icTimes = require('../../images/times.svg').default;


// Global State
/**@type {RTCPeerConnection} */
let peerConnection = null;

/**@type {MediaStream} */
let localStream = null;

/**@type {MediaStream} */
let remoteStream = null;

let isLocalScreenSharingFlag = false

var candidates = [];
let socket;
let soundMeter;


export const VideoCall = () => {

    const [isAuthorized, setAuthorized] = useState(false);
    const [isFirstAttempt, setFirstAttempt] = useState(true);

    const [isJoined, setJoined] = useState(false);
    const [isCalling, setCalling] = useState(false);
    const [isCallStarted, setCallStarted] = useState(false);

    const [isRemoteMicMute, setRemoteMicMute] = useState(false);
    const [isRemoteVideoMute, setRemoteVideoMute] = useState(false);
    const [isRemoteScreenSharingEnabled, setRemoteScreenSharingEnabled] = useState(false);
    const [isRemoteBoardOpen, setRemoteBoardOpen] = useState(false);
    const [remoteAudioReading, setRemoteAudioReading] = useState(0);

    const [isLocalAudioSharing, setLocalAudioSharing] = useState(false);
    const [isLocalVideoSharing, setLocalVideoSharing] = useState(false);
    const [isLocalScreenSharing, setLocalScreenSharing] = useState(false);

    const [isLocalBoardOpen, setLocalBoardOpen] = useState(false);
    const [boardUrl, setBoardUrl] = useState(null);

    const [micDeviceId, setMicDeviceId] = useState('');
    const [cameraDeviceId, setCameraDeviceId] = useState('');

    const [isAudioDeviceModelHidden, setIsAudioDeviceModelHidden] = useState(true);
    const [isVideoDeviceModelHidden, setIsVideoDeviceModelHidden] = useState(true);

    const [webcamVideoRef, setWebcamVideoRef] = useState(React.createRef());
    const [remoteVideoRef, setRemoteVideoRef] = useState(React.createRef());

    const [isLocalVideoHidden, setLocalVideoHidden] = useState(false);

    const [user, setUser] = useState({});
    const [remoteUser, setRemoteUser] = useState({});

    const [videoDevices, setVideoDevices] = useState([]);
    const [audioDevices, setAudioDevices] = useState([]);

    const { token, meetingId, lang } = useParams();

    const endCallCallback = (event, res) => {
        console.log(event, res)
        if (res.message) toast(res.message)
        endVideoCall()
    }

    function initSocket() {

        // io.connect('', {
        //     "path": window.location.pathname.split("/boards/")[0] + "/socket.io",
        //     "reconnection": true,
        //     "reconnectionDelay": 100, //Make the xhr connections as fast as possible
        //     "timeout": 1000 * 60 * 20 // Timeout after 20 minutes
        // })
        
        socket = io("", IOConfig);

        socket.on(IOEvents.CONNECT, function () {
            socket.emit(IOEvents.SET_LANGUAGE, {
                locale: lang ?? "en"
            })
            console.log(IOEvents.CONNECT)
            socket.emit(IOEvents.AUTHORIZATION, { authorization: decodeURIComponent(token) })
        });

        socket.on(IOEvents.AUTHORIZATION, function (res) {
            console.log(IOEvents.AUTHORIZATION, res)
            if (res.success) {
                setAuthorized(true)
                if (isCallStarted) {
                    console.log("RECONNECTING")
                    socket.emit(IOEvents.RECONNECTING, { meetingId: meetingId })
                } else {
                    setUser(res.data);
                    initLocalStream();
                }
            }
            else {
                setAuthorized(false)
                setUser({});
                toast("You are not authorized")
            }
        });

        socket.on(IOEvents.REJOIN_ROOM, res => {
            if (res.success) {
                toast("Reconnected")
            } else {
                endVideoCall()
            }
        })

        socket.on(IOEvents.NEW_OFFER, async (res) => {
            console.log(IOEvents.NEW_OFFER, res);
            if (res.data) {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(res.data));
                const answerDescription = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answerDescription);
                // -------------------------------------- //
                // --------------SEND ANSWER------------- //
                // -------------------------------------- //
                socket.emit(IOEvents.NEW_ANSWER, {
                    type: IOEvents.NEW_ANSWER,
                    data: {
                        type: answerDescription.type,
                        sdp: answerDescription.sdp,
                    }
                });
            }
        });

        socket.on(IOEvents.NEW_ANSWER, res => {
            console.log(IOEvents.NEW_ANSWER, res);
            if (res.data) {
                console.log(IOEvents.NEW_ANSWER);
                const answerDescription = new RTCSessionDescription(res.data);
                peerConnection.setRemoteDescription(answerDescription);
            }
        });

        socket.on(IOEvents.ALREADY_JOINED, res => endCallCallback(IOEvents.ALREADY_JOINED, res));
        socket.on(IOEvents.INVALID_PARTICIPANT, res => endCallCallback(IOEvents.INVALID_PARTICIPANT, res));
        socket.on(IOEvents.MEETING_NOT_FOUND, res => endCallCallback(IOEvents.MEETING_NOT_FOUND, res));
        socket.on(IOEvents.MEETING_NOT_ACTIVE, res => endCallCallback(IOEvents.MEETING_NOT_ACTIVE, res));
        socket.on(IOEvents.ROOM_NOT_FOUND, res => endCallCallback(IOEvents.ROOM_NOT_FOUND, res));

        socket.on(IOEvents.CREATE_ROOM, () => {
            console.log(IOEvents.CREATE_ROOM)
            if (isFirstAttempt) {
                setFirstAttempt(false)
                peerConnection.close()
                setTimeout(() => {
                    startVideoCall()
                }, 200);
            } else {
                toast("Failed to connect to peer, try again")
                endVideoCall()
            }
        })

        socket.on(IOEvents.ROOM_EXIST, function () {
            console.log(IOEvents.ROOM_EXIST)
            peerConnection.close()
            setTimeout(() => {
                initPeerConnection()
                joinRoom()
            }, 200);

        });

        socket.on(IOEvents.CREATE_ICE_EVENT_DATA, (res) => {
            console.log(IOEvents.CREATE_ICE_EVENT_DATA, res)
            try {
                if (res.data) {
                    console.log(IOEvents.CREATE_ICE_EVENT_DATA);
                    const candidate = new RTCIceCandidate(res.data);
                    peerConnection.addIceCandidate(candidate);
                }
            } catch (error) {
                console.log("CREATE_ICE_EVENT_DATA_ERROR", error)
            }
        });

        socket.on(IOEvents.RECEIVE_ANSWER, (res) => {
            console.log(IOEvents.RECEIVE_ANSWER, res)
            if (res.user) {
                setRemoteUser(res.user)
            }
            if (!peerConnection.currentRemoteDescription && res.answer) {
                console.log(IOEvents.RECEIVE_ANSWER);
                const answerDescription = new RTCSessionDescription(res.answer);
                peerConnection.setRemoteDescription(answerDescription);
                socket.emit(IOEvents.START_CALL, {
                    type: IOEvents.RECEIVE_ANSWER
                });
            }
        });

        socket.on(IOEvents.ROOM_JOIN, async (res) => {
            console.log(IOEvents.ROOM_JOIN, res)
            try {
                if (res.data) {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(res.data));
                    const answerDescription = await peerConnection.createAnswer();
                    await peerConnection.setLocalDescription(answerDescription);
                    // --------------------------------------- //
                    // ---------------SEND ANSWER------------- //
                    // --------------------------------------- //
                    socket.emit(IOEvents.ANSWER_CALL, {
                        type: IOEvents.ANSWER_CALL,
                        data: {
                            type: answerDescription.type,
                            sdp: answerDescription.sdp,
                        }
                    });
                }
            } catch (error) {
                console.log("ROOM_JOIN_ERROR", error)
            }
        });

        socket.on(IOEvents.JOINED_ROOM_AS_RECEIVER, function (res) {
            console.log(IOEvents.JOINED_ROOM_AS_RECEIVER, res)
            if (res.data) {
                setRemoteUser(res.data);
                setJoined(true);
            } else {
                endVideoCall()
            }
        });

        socket.on(IOEvents.CALL_ON_WAIT, () => {
            console.log(IOEvents.CALL_ON_WAIT)
            setJoined(true)
        });

        socket.on(IOEvents.START_CALL, () => {
            console.log(IOEvents.START_CALL)
            stopSound('sound-calling');
            playSound('sound-call-started', false);
            setupIceEventOnStartCall()
            setCallStarted(true)
        });

        socket.on(IOEvents.END_CALL, () => {
            console.log(IOEvents.END_CALL)
            endVideoCall()
        });

        socket.on(IOEvents.MUTE_AUDIO, () => {
            console.log(IOEvents.MUTE_AUDIO)
            setRemoteMicMute(true)
        });

        socket.on(IOEvents.UNMUTE_AUDIO, () => {
            console.log(IOEvents.UNMUTE_AUDIO)
            setRemoteMicMute(false);
        });

        socket.on(IOEvents.MUTE_VIDEO, () => {
            console.log(IOEvents.MUTE_VIDEO)
            setRemoteVideoMute(true)
        });

        socket.on(IOEvents.UNMUTE_VIDEO, () => {
            console.log(IOEvents.UNMUTE_VIDEO)
            setRemoteVideoMute(false)
        });

        socket.on(IOEvents.SCREEN_SHARING_ENABLED, () => {
            console.log(IOEvents.SCREEN_SHARING_ENABLED)
            setRemoteScreenSharingEnabled(true)
        });

        socket.on(IOEvents.SCREEN_SHARING_DISABLED, () => {
            console.log(IOEvents.SCREEN_SHARING_DISABLED)
            setRemoteScreenSharingEnabled(false)
        });

        socket.on(IOEvents.OPEN_BOARD, () => {
            console.log(IOEvents.OPEN_BOARD)
            setRemoteBoardOpen(true)
        });

        socket.on(IOEvents.CLOSE_BOARD, () => {
            console.log(IOEvents.CLOSE_BOARD)
            setRemoteBoardOpen(false)
        });
    }

    function endCallOnReload() {
        console.log("Page Reloading")
        socket.emit(IOEvents.END_CALL)
        window.removeEventListener("beforeunload", endCallOnReload);
    }

    async function createOffer() {
        if (peerConnection) {
            const offerDescription = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offerDescription);

            socket.emit(IOEvents.NEW_OFFER, {
                data: {
                    sdp: offerDescription.sdp,
                    type: offerDescription.type,
                }
            });
            console.log("CREATING RE-NEGOTIATION OFFER");
        }
    }

    async function init() {
        initSocket()
        updateDevices()
        navigator.mediaDevices.addEventListener('devicechange', updateDevices)
        window.addEventListener("beforeunload", endCallOnReload)
    }


    function initPeerConnection() {
        try {
            // Global State
            peerConnection = new RTCPeerConnection(servers);
            remoteStream = new MediaStream();

            setupIceEventBeforeStartCall()

            peerConnection.onnegotiationneeded = createOffer;
            // Push tracks from local stream to peer connection
            localStream.getTracks().forEach((track) => {
                peerConnection.addTrack(track, localStream);
            });

            // Pull tracks from remote stream, add to video stream
            peerConnection.ontrack = (event) => {
                event.streams[0].getTracks().forEach((track) => {
                    console.log("NEW " + track.kind + " TRACK ADDED TO REMOTE STREAM");
                    remoteStream.addTrack(track);
                });
            };

            remoteVideoRef.current.srcObject = remoteStream
        } catch (error) {
            console.log("INIT_PEER_CONNECTION_ERROR", error)
        }
    }

    function setupIceEventOnStartCall() {

        console.log("SETUP_ICE_EVENT_ON_START_CALL");

        candidates.forEach(c => {
            console.log("ICE_ARRAY_EVENT")
            socket.emit(IOEvents.CREATE_ICE_EVENT_DATA, {
                type: IOEvents.CREATE_ICE_EVENT_DATA,
                data: c
            });
        });

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("LOCAL_ICE_EVENT",)
                socket.emit(IOEvents.CREATE_ICE_EVENT_DATA, {
                    type: IOEvents.CREATE_ICE_EVENT_DATA,
                    data: event.candidate.toJSON()
                });
            }
        };

    }

    function setupIceEventBeforeStartCall() {
        console.log("SETUP_ICE_EVENT_BEFORE_START_CALL");
        candidates = []
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("ICE_EVENT_BEFORE_START_CALL")
                candidates.push(event.candidate.toJSON())
            }
        };

    }

    function closeConnection() {
        closeStreamsAndResetVideo(peerConnection, remoteStream, remoteVideoRef, 'remote');
        closeStreamsAndResetVideo(peerConnection, localStream, webcamVideoRef, 'local');
        peerConnection = null
    }

    async function initLocalStream() {
        try {
            localStream = new MediaStream();
            webcamVideoRef.current.srcObject = localStream
        } catch (error) {
            console.log("INIT_LOCAL_STREAM_ERROR", error)
        }
    }

    function toggleBoard() {
        socket.emit(isLocalBoardOpen ? IOEvents.CLOSE_BOARD : IOEvents.OPEN_BOARD)
        setBoardUrl(isLocalBoardOpen ? null : getWhiteboardUrl(meetingId, user.userId))
        setLocalBoardOpen(isLocalBoardOpen => !isLocalBoardOpen)

    }

    function createRoom() {
        setTimeout(async () => {
            try {
                const offerDescription = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offerDescription);

                socket.emit(IOEvents.CREATE_ROOM, {
                    type: IOEvents.CREATE_ROOM,
                    meetingId: meetingId,
                    data: {
                        sdp: offerDescription.sdp,
                        type: offerDescription.type,
                    }
                });
            } catch (error) {
                console.log("CREATE_ROOM_FUNCTION_ERROR", error)
            }
        }, 1000);
    }

    function joinRoom() {
        let evtData = {
            type: IOEvents.ROOM_JOIN,
            meetingId: meetingId,
        }
        setTimeout(() => socket.emit(IOEvents.ROOM_JOIN, evtData), 1000);
    }

    function sendInitialEvents() {
        if (socket && isCallStarted) {
            console.log(`Local audio==>${isLocalAudioSharing}, Local video==>${isLocalVideoSharing}`)
            socket.emit(isLocalAudioSharing ? IOEvents.UNMUTE_AUDIO : IOEvents.MUTE_AUDIO)
            socket.emit(isLocalVideoSharing ? IOEvents.UNMUTE_VIDEO : IOEvents.MUTE_VIDEO)
        }
    }


    async function toggleMicrophone() {
        console.log("MIC_ID", micDeviceId)
        try {
            if (isLocalAudioSharing) {
                removeAllAudioTracks(peerConnection, localStream);
            }
            else {
                let failed = await setNewAudioTrack(peerConnection, localStream, micDeviceId)
                if (failed) throw failed;
            }
            socket.emit(isLocalAudioSharing ? IOEvents.MUTE_AUDIO : IOEvents.UNMUTE_AUDIO)
            setLocalAudioSharing(isLocalAudioSharing => !isLocalAudioSharing)
        } catch (error) {
            console.log(error)
            toast("MicroPhone is not enabled")
        }
    }

    async function toggleVideo() {
        try {
            stopScreenStream()

            if (isLocalVideoSharing) {
                removeAllVideoTracks(peerConnection, localStream);
                webcamVideoRef.current.srcObject = null
            }
            else {
                let failed = await setNewVideoTrack(peerConnection, localStream, 'webcam', cameraDeviceId)
                if (failed) throw "TOGGLE_VIDEO_TO_TRUE_FAILED " + failed
                webcamVideoRef.current.srcObject = localStream
            }
            socket.emit(isLocalVideoSharing ? IOEvents.MUTE_VIDEO : IOEvents.UNMUTE_VIDEO)
            setLocalVideoSharing(isLocalVideoSharing => !isLocalVideoSharing)
        } catch (error) {
            console.log(error)
            toast("Camera is not enabled")
        }
    }

    async function stopWebcamStream() {
        if (isLocalVideoSharing) {
            removeAllVideoTracks(peerConnection, localStream);
            webcamVideoRef.current.srcObject = null
            socket.emit(IOEvents.MUTE_VIDEO)
            setLocalVideoSharing(false)
        }
    }

    async function stopScreenStream() {
        removeAllVideoTracks(peerConnection, localStream);
        webcamVideoRef.current.srcObject = null
        isLocalScreenSharingFlag = false
        socket.emit(IOEvents.SCREEN_SHARING_DISABLED)
        setLocalScreenSharing(isLocalScreenSharingFlag)
    }

    async function toggleScreenShare() {
        try {
            stopWebcamStream()

            if (isLocalScreenSharingFlag) {
                removeAllVideoTracks(peerConnection, localStream);
                webcamVideoRef.current.srcObject = null
            }
            else {
                let failed = await setNewVideoTrack(peerConnection, localStream, 'screen', null, toggleScreenShare)
                if (failed) {
                    webcamVideoRef.current.srcObject = isLocalVideoSharing ? localStream : null
                    throw "Screen Share Cancelled. " + failed
                }
                webcamVideoRef.current.srcObject = localStream
            }

            isLocalScreenSharingFlag = !isLocalScreenSharingFlag
            socket.emit(isLocalScreenSharingFlag ? IOEvents.SCREEN_SHARING_ENABLED : IOEvents.SCREEN_SHARING_DISABLED)
            setLocalScreenSharing(isLocalScreenSharingFlag)

        } catch (error) {
            console.log("Screen Toggle Error", error)
        }
    }

    async function startVideoCall() {
        setCalling(true)
        playSound('sound-calling', true);
        initPeerConnection()
        setTimeout(createRoom, 1000);
    }

    function endVideoCall() {
        socket.emit(IOEvents.END_CALL);
        stopSound('sound-calling');
        playSound('sound-call-ended', false)
        closeConnection()
        resetAllStates()
    }

    function resetAllStates() {
        setFirstAttempt(true)
        setJoined(false)
        setCalling(false)
        setCallStarted(false)
        setRemoteMicMute(false)
        setRemoteVideoMute(false)
        setRemoteScreenSharingEnabled(false)
        setRemoteBoardOpen(false)
        setRemoteAudioReading(0)

        setLocalAudioSharing(false)
        setLocalVideoSharing(false)
        setLocalScreenSharing(false)
        isLocalScreenSharingFlag = false

        setLocalBoardOpen(false)
        setBoardUrl(null)
        setLocalVideoHidden(false)
        webcamVideoRef.current.srcObject = null
        remoteVideoRef.current.srcObject = null

        setMicDeviceId('default')
        setCameraDeviceId('default')
        setIsVideoDeviceModelHidden(true)
        setIsAudioDeviceModelHidden(true)

        setRemoteUser({})
        setTimeout(initLocalStream, 100)
    }

    function isVideoInNormalState() {
        let active = false
        if (isCallStarted) active = true
        if (isRemoteVideoMute) active = false
        if (isRemoteScreenSharingEnabled) active = true
        return active
    }


    async function selectMicDevice(deviceId) {
        console.log("SELECTED_MIC_DEVICE_ID", deviceId)
        setMicDeviceId(deviceId)
        setIsAudioDeviceModelHidden(true)
        if (isLocalAudioSharing) {
            setNewAudioTrack(peerConnection, localStream, deviceId)
        }
    }

    async function selectCameraDevice(deviceId) {
        console.log("SELECTED_CAMERA_DEVICE_ID", deviceId)
        setCameraDeviceId(deviceId)
        setIsVideoDeviceModelHidden(true)
        if (isLocalVideoSharing) {
            setNewVideoTrack(peerConnection, localStream, 'webcam', deviceId)
        }
    }

    async function updateDevices() {
        if (await isCameraAvailable()) {
            let devices = await getVideoMediaDevices();
            setVideoDevices(devices);
            if (!cameraDeviceId && devices.length > 0) {
                setCameraDeviceId(devices[0].deviceId);
            }
        }

        if (await isAudioAvailable()) {
            let devices = await getAudioMediaDevices();
            setAudioDevices(devices);
            if (!micDeviceId && devices.length > 0) {
                setMicDeviceId(devices[0].deviceId);
            }
        }
    }

    useEffect(init, []);

    useEffect(sendInitialEvents, [isCallStarted])

    useEffect(() => {
        console.log("IS_LOCAL_SCREEN_SHARING", isLocalScreenSharing, isLocalScreenSharingFlag)
    }, [isLocalScreenSharing, isLocalVideoSharing])

    useEffect(() => {
        console.log("IS_LOCAL_VIDEO_SHARING", isLocalVideoSharing)
    }, [isLocalVideoSharing])

    useEffect(updateDevices, [isLocalAudioSharing, isLocalVideoSharing])

    useEffect(() => {
        if (isLocalVideoSharing && !videoDevices.find(m => m.deviceId === cameraDeviceId)) {
            toggleVideo();
        }
    }, [cameraDeviceId])

    useEffect(() => {
        if (isLocalAudioSharing && !audioDevices.find(m => m.deviceId === micDeviceId)) {
            toggleMicrophone();
        }
    }, [micDeviceId])


    useEffect(() => {

        function startSoundMeter() {
            if (isCallStarted) {
                if (remoteStream.getAudioTracks().length > 0) {
                    soundMeter = new SoundMeter(
                        new AudioContext(),
                        instant => setRemoteAudioReading(instant)
                    );
                    soundMeter.connectToSource(remoteStream);
                } else {
                    setTimeout(startSoundMeter, 2000);
                }
            }
        }

        function endSoundMeter() {
            if (soundMeter) {
                soundMeter.stop();
                soundMeter = null;
            }
            setRemoteAudioReading(0)
        }

        // Clearning Sound Meter instance if exists
        endSoundMeter();

        // starting new sound meter instance if audio is unmuted
        if (!isRemoteMicMute) startSoundMeter()
    }, [isRemoteMicMute])

    return (
        <>
            {
                !isCallStarted &&
                <div id="overlay"></div>
            }
            {
                !isAuthorized &&
                <div id="loader"><img alt="" src={icLoader} /></div>
            }
            {
                isAuthorized &&
                <div className="c-row ">
                    <div className="c-col-12" id="videos" >
                        <span
                            style={{
                                display: isLocalVideoSharing && !isLocalVideoHidden ? "initial" : "none",
                            }}
                        >
                            <VideoContainer
                                containerId="webcamVideo"
                                reference={webcamVideoRef}
                                isMuted={true}
                                isActive={isVideoInNormalState()} />
                            {
                                isCallStarted && (!isRemoteVideoMute || isRemoteScreenSharingEnabled) &&
                                <button id="hideLocalVideoBtn" onClick={() => setLocalVideoHidden(true)}>
                                    <img alt="" src={icTimes} />
                                </button>
                            }
                        </span>
                        <span>
                            <VideoContainer
                                containerId="remoteVideo"
                                reference={remoteVideoRef}
                                isMuted={false}
                                isActive={isVideoInNormalState()} />
                        </span>
                        {
                            isLocalScreenSharing &&
                            <div className="local-screen-sharing">
                                <img alt="" src={icScreenSharing}></img>
                            </div>
                        }

                        <Whiteboard visible={isLocalBoardOpen} url={boardUrl} onBack={toggleBoard} backIcon={icPhoneOn} />

                        {
                            isCallStarted &&
                            <>
                                <div id="indicator-container"
                                    className={isLocalBoardOpen ? "board" : (isLocalVideoSharing || isLocalScreenSharing || !isRemoteVideoMute || isRemoteScreenSharingEnabled ? "" : "active")}
                                >
                                    <div className="btns">
                                        {
                                            Object.keys(remoteUser).length > 0 &&
                                            <>
                                                <div
                                                    className={"soundBubble"}
                                                    style={{ transform: `scale(${audioScale(remoteAudioReading)})` }}
                                                >
                                                </div>
                                                <div className="remoteUserName">
                                                    <p>
                                                        {getNameInitials(remoteUser.name)}
                                                    </p>
                                                </div>
                                            </>
                                        }
                                    </div>
                                    <div className="indicator">
                                        <Indicator visible={isRemoteMicMute} icon={icMicSlash} />
                                        <Indicator visible={isRemoteVideoMute} icon={icVideoSlash} />
                                        <Indicator visible={isRemoteScreenSharingEnabled} icon={icScreenSharing} />
                                        <Indicator visible={isRemoteBoardOpen} icon={icBrush} />
                                    </div>
                                </div>
                            </>
                        }
                    </div>
                    <div className={`call-controls-container ${isCallStarted ? 'calling' : 'not-calling'} c-col-12`}>
                        <div className="c-row">
                            <div
                                id="my-user-info"
                                className=" c-col-12 text-center"
                                style={{ display: isCallStarted ? "none" : "initial" }}
                            >
                                <div>
                                    <p>{getNameInitials(user.name)}</p>
                                </div>
                            </div>
                            <div className="c-col-12 main-call-controls">
                                <CallControl
                                    id="hangupButton"
                                    visible={isCalling || isCallStarted}
                                    onClick={endVideoCall}
                                    icon={icPhoneOff}
                                />
                                <span
                                    className="media-device-container"
                                >
                                    <CallControl
                                        visible={true}
                                        onClick={toggleMicrophone}
                                        icon={isLocalAudioSharing ? icMic : icMicSlash}
                                    >
                                        <SelectDeviceTrigger
                                            visible={audioDevices.length > 0}
                                            onClick={() => setIsAudioDeviceModelHidden(false)}
                                        />
                                    </CallControl>



                                </span>
                                <span
                                    className={isLocalVideoSharing ? "media-device-container" : "media-device-container active"}
                                >
                                    <CallControl
                                        visible={true}
                                        disabled={isLocalScreenSharing}
                                        onClick={toggleVideo}
                                        icon={isLocalVideoSharing ? icVideo : icVideoSlash}
                                    >
                                        <SelectDeviceTrigger
                                            visible={videoDevices.length > 0}
                                            onClick={() => setIsVideoDeviceModelHidden(false)}
                                        />
                                    </CallControl>
                                </span>
                                {
                                    isCallStarted &&
                                    <>
                                        <CallControl
                                            visible={true}
                                            onClick={toggleScreenShare}
                                            icon={isLocalScreenSharing ? icScreenSharingSlash : icScreenSharing}
                                        />

                                        <CallControl
                                            visible={isLocalVideoHidden}
                                            onClick={() => setLocalVideoHidden(false)}
                                            icon={icPortrait}
                                        />

                                        <CallControl
                                            visible={true}
                                            onClick={toggleBoard}
                                            icon={icBrush}
                                        />

                                    </>
                                }
                            </div>
                            <div className="c-col-12 secondary-call-controls">
                                {
                                    !isCallStarted &&
                                    <button id="joinBtn"
                                        disabled={isCalling || !isAuthorized}
                                        onClick={startVideoCall}
                                        className={isCalling ? 'calling' : ''}
                                    >
                                        {
                                            !isCalling ? "JOIN" : (isJoined ? "WAITING FOR SOMEONE TO JOIN" : "JOINING")
                                        }
                                    </button>
                                }
                            </div>
                        </div>
                    </div>
                    <SelectDevice
                        visible={!isAudioDeviceModelHidden}
                        devices={audioDevices}
                        title={"Select Microphone"}
                        placeholder="Select a Microphone"
                        selectedDevicesId={micDeviceId}
                        onSelectDevice={selectMicDevice}
                        onClose={() => setIsAudioDeviceModelHidden(true)}
                    />

                    <SelectDevice
                        visible={!isVideoDeviceModelHidden}
                        devices={videoDevices}
                        title={"Select Camera"}
                        placeholder="Select a camera devices"
                        selectedDevicesId={cameraDeviceId}
                        onSelectDevice={selectCameraDevice}
                        onClose={() => setIsVideoDeviceModelHidden(true)}
                    />
                </div>
            }

            <div className="text-center">
                <div id="snackbar"></div>
            </div>

            <ApplicationSounds />
        </>
    );

}
