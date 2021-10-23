export const URLs = {
    // main: 'http://192.168.10.101:3601',
    // rootApi: 'http://192.168.10.102:3600',
    // feedback: 'http://192.168.10.101:3600/meetings/feedback',
    // whiteBoard: "https://whiteboard.infonow.ro/boards",
    main: 'https://meet.infonow.ro/',
    rootApi: 'https://api.infonow.ro/',
    feedback: 'https://meet.infonow.ro/api/meetings/feedback',
    whiteBoard: "https://whiteboard.infonow.ro/boards"
}

export const getWhiteboardUrl = (meetingId, userId) => `${URLs.whiteBoard}/${meetingId}?lang=ro`;

