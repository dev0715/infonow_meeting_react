export const URLs = {
    main: 'https://meet.meditati.ro/',
    // main: 'https://6bb9e66f37b9.ngrok.io',
    // whiteBoard: 'https://88ecdfca292a.ngrok.io/boards',
    whiteBoard: "https://whiteboard.meditati.ro/boards"
}

export const getWhiteboardUrl = (meetingId, userId) => `${URLs.whiteBoard}/${meetingId}`;

