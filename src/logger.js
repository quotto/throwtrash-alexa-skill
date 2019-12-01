exports.ERROR = '0'
exports.WARN = '1'
exports.INFO = '2'
exports.DEBUG = '3'
exports.LEVEL = this.INFO;

exports.error = (message)=>{
    if(this.LEVEL >= this.ERROR) {
        console.error(message);
        return true;
    }
    return false;
}
exports.warn = (message)=>{
    if(this.LEVEL >= this.WARN) {
        console.warn(message);
        return true;
    }
    return false;
}
exports.info = (message)=>{
    if(this.LEVEL >= this.INFO) {
        console.info(message);
        return true;
    }
    return false;
}
exports.debug = (message)=>{
    if(this.LEVEL >= this.DEBUG) {
        console.debug(message);
        return true;
    }
    return false;
}