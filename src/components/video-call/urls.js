export const URLs = {
    main: 'http://192.168.10.104:3601',
    whiteBoard: "http://192.168.10.101:3001/boards"
}

export const getWhiteboardUrl = (meetingId, userId) => `${URLs.whiteBoard}/${meetingId}`;

