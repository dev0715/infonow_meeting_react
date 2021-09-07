export const URLs = {
    // main: 'http://192.168.10.104:3901',
    // whiteBoard: 'https://88ecdfca292a.ngrok.io/boards',
    main: 'https://meet.meditati.ro/',
    whiteBoard: "https://whiteboard.meditati.ro/boards"
}

export const getWhiteboardUrl = (meetingId, userId) => `${URLs.whiteBoard}/${meetingId}`;

