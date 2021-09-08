export const URLs = {
    main: 'http://192.168.10.104:3901',
    // feedback: 'http://192.168.10.104:3900/meetings/feedback',
    // whiteBoard: 'https://88ecdfca292a.ngrok.io/boards',
    // main: 'https://meet.meditati.ro/',
    feedback: 'https://meet.meditati.ro/api/meetings/feedback',
    whiteBoard: "https://whiteboard.meditati.ro/boards"
}

export const getWhiteboardUrl = (meetingId, userId) => `${URLs.whiteBoard}/${meetingId}`;

