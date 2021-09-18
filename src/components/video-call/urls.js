export const URLs = {
    // main: 'http://192.168.10.101:3601',
    // feedback: 'http://192.168.10.101:3600/meetings/feedback',
    // whiteBoard: "https://whiteboard.meditati.ro/boards",
    main: 'https://meet.meditati.ro/',
    feedback: 'https://meet.meditati.ro/api/meetings/feedback',
    whiteBoard: "https://whiteboard.meditati.ro/boards"
}

export const getWhiteboardUrl = (meetingId, userId) => `${URLs.whiteBoard}/${meetingId}`;

