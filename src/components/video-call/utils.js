
/**
 * 
 * @param {string} name 
 */
export function getNameInitials(name) {
    if (!name) return "";
    if (name.indexOf(' ') > -1) {
        let names = name.split(' ');
        return names[0] + names[1];
    }
    else {
        return name.substr(0, 2);
    }
}