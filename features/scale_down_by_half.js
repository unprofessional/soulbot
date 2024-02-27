// recursive utility function
const scaleDownByHalf = (
    { height, width },
    mediaMaxHeight,
    mediaMaxWidth,
) => {
    // console.log('>>>>> scaleDownByHalf > height: ', height);
    // console.log('>>>>> scaleDownByHalf > width: ', width);
    if(height < mediaMaxHeight && width < mediaMaxWidth) {
        return {
            height,
            width,
        };
    }
    return scaleDownByHalf(
        {
            height: Math.floor(height/2),
            width: Math.floor(width/2),
        },
        mediaMaxHeight,
        mediaMaxWidth,
    );
};

module.exports = {
    scaleDownByHalf
};
