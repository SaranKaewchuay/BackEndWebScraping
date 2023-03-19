
// i เจอครั้งเดียวจบ
// g เจอทุกอันเอาหมด

// [0-9]{2}\/[0-9]{2}\/[0-9]{4}

const getDate = async(str) =>{
    let pattern = /[0-9]{2}\/[0-9]{2}\/[0-9]{4}/gi
    let result = "";
    try {
        result = str.match(pattern)[0]
    }catch (error){
        result = ""
    }

    return result
}
const change = async(str) =>{
    const newString = str.replace(/�/g, '-'); 
    return newString
}


const removeSpace = async(str) =>{
    let pattern = /  +/g
    let result = "";
    result = str.replace(pattern,"")

    return result
}

const removeNewLine = async(str) => {
    //let pattern = /\r?\n|\r|\t/g
    let pattern = /[A-Za-zก-๙0-9:\/ ]/g
    let result = "";
    //result = await removeSpace(str.replace(pattern,""));
    result = removeSpace (str.match(pattern).join(""))

    return result
}

module.exports={
    getDate,
    removeNewLine,
    removeSpace,
    change
}