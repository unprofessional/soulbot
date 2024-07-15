/**
 * Recursively dividing dimension by a scale of 1.1
 */
// const scaleDownToFit = (
//     { height, width },
//     mediaMaxHeight,
//     mediaMaxWidth,
// ) => {
//     // console.log('>>>>> scaleDownByHalf > height: ', height);
//     // console.log('>>>>> scaleDownByHalf > width: ', width);
//     if(height < mediaMaxHeight && width < mediaMaxWidth) {
//         return {
//             height,
//             width,
//         };
//     }
//     return scaleDownToFit(
//         {
//             height: Math.floor(height/1.1),
//             width: Math.floor(width/1.1),
//         },
//         mediaMaxHeight,
//         mediaMaxWidth,
//     );
// };

const scaleDownToFitAspectRatio = (
    { height, width },
    mediaMaxHeight,
    mediaMaxWidth,
    compensatedHeight,
) => {
    const aspectRatio = width / height;
    console.log('>>> scaleDownToFitAspectRatio > aspectRatio: ', aspectRatio);

    console.log('>>> scaleDownToFitAspectRatio > mediaMaxHeight: ', mediaMaxHeight);
    console.log('>>> scaleDownToFitAspectRatio > mediaMaxWidth: ', mediaMaxWidth);

    if (width > mediaMaxWidth) {
        width = mediaMaxWidth;
        height = Math.floor(mediaMaxWidth / aspectRatio);
    }

    if (height > (mediaMaxHeight - compensatedHeight)) {
        height = (mediaMaxHeight - compensatedHeight);
        width = Math.floor((mediaMaxHeight - compensatedHeight) * aspectRatio);
    }

    console.log('>>> scaleDownToFitAspectRatio > height: ', height);
    console.log('>>> scaleDownToFitAspectRatio > width: ', width);

    return {
        height,
        width,
    };
};


module.exports = {
    // scaleDownToFit,
    scaleDownToFitAspectRatio,
};


