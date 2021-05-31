export const URLs = {
    // main: 'http://192.168.10.104:3601',
    main: 'https://6bb9e66f37b9.ngrok.io',
    whiteBoard: 'https://88ecdfca292a.ngrok.io/boards',
    // whiteBoard: "http://192.168.10.101:3001/boards"
}

export const getWhiteboardUrl = (meetingId, userId) => `${URLs.whiteBoard}/${meetingId}`;

