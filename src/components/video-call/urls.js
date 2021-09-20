export const URLs = {
    // main: 'http://192.168.10.101:3601',
    // rootApi: 'http://192.168.10.102:3600',
    // feedback: 'http://192.168.10.101:3600/meetings/feedback',
    // whiteBoard: "https://whiteboard.meditati.ro/boards",
    main: 'https://meet.meditati.ro/',
    rootApi: 'https://api.meditati.ro/main',
    feedback: 'https://meet.meditati.ro/api/meetings/feedback',
    whiteBoard: "https://whiteboard.meditati.ro/boards"
}

export const getWhiteboardUrl = (meetingId, userId) => `${URLs.whiteBoard}/${meetingId}`;

