const validateYTUri = (uri) => {
    const YOUTUBE_REGEX = new RegExp(
        '((^(http(s)?:\\/\\/)?((w){3}.)?youtube.com?\\/watch\\?v=.+)|(^(http(s)?:\\/\\/)?((w){3}.)?youtu.be?\\/.+))',
    )
    console.log(uri);
    const matches = uri.match(YOUTUBE_REGEX)
    if (matches?.length === 0) {
        return false;
    }
    return true;
};


module.exports = { validateYTUri };