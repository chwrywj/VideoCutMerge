const { contextBridge, ipcRenderer, shell } = require('electron')
const fs = require('fs');
const path = require('path');

const FfmpegClass = require('./src/js/FfmpegClass');
let ffmpegClass = new FfmpegClass();

contextBridge.exposeInMainWorld('electronAPI', {
  openBrowser: (url) => {
    shell.openExternal(url);
  },
  
  openPath: (url) => {
    shell.openPath(url);
  },

  dialogOpenFile: (extArr, multiSelections) => ipcRenderer.invoke('dialog:openFile', extArr, multiSelections),

  dialogOpenDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),

  diaglogSaveFile: (extArr) => ipcRenderer.invoke('dialog:saveFile', extArr),

  getFilesFromDir: (inputPath,extArr) => {
    var fileData=[];
    const readImgFilePath = (directoryPath) => {
      directoryPath = path.resolve(directoryPath);
      const files = fs.readdirSync(directoryPath);
      files.forEach((file) => {
          const filePath  = path.join(directoryPath, file);
          const stat = fs.statSync(filePath);
          if (stat.isFile()) {
            var extname = path.extname(file).toLocaleLowerCase();
            if(extname!=null && extname!=''){
              extname=extname.substring(1);
              if(extArr.includes(extname)){
                fileData.push({
                  filePath:filePath,
                  fileSize:stat.size
                })
              }
            }
          } else if (stat.isDirectory()){
            readImgFilePath(filePath);
          }
      });
    }
    readImgFilePath(inputPath);
    return fileData;
  },

  getFileSize:(filePath)=>{
    filePath = path.resolve(filePath);
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      return stat.size;
    }else{
      return null;
    }
  },

  fileExists:(filePath)=>{
    return fs.existsSync(path.resolve(filePath));
  },

  deleteFile:(filePath)=>{
    try{
      if(fs.existsSync(path.resolve(filePath))){
        fs.unlinkSync(filePath);
      }
      return true;
    }catch(e){return false;}
  },

  writeFile:(filePath,content)=>{
    if(fs.existsSync(path.resolve(filePath))){
      fs.unlinkSync(filePath);
    }
    fs.writeFileSync(filePath,content);
  },

  makeDir:(dirPath)=>{
    try{
      if(!fs.existsSync(path.resolve(dirPath))){
        fs.mkdirSync(dirPath);
      }
      return true;
    }catch(e){
      console.log(e)
      return false;
    }
  },

  deleteDir:(dirPath)=>{
    var deleteDirRecursive=function(dirPath){
      var files = [];
      if(fs.existsSync(dirPath)) {
        files = fs.readdirSync(dirPath);
        files.forEach(function(file, index) {
          var curPath = dirPath + "/" + file;
          if(fs.statSync(curPath).isDirectory()) {
            deleteDirRecursive(curPath);
          } else {
            fs.unlinkSync(curPath);
          }
        });
        fs.rmdirSync(dirPath);
      }
    };
    deleteDirRecursive(dirPath);
  },

  getVideoOrAudioMetaData:(videoPath,callback)=>{
    ffmpegClass.getVideoOrAudioMetaData(videoPath,callback);
  },

  selectVideoForCut: (videoFilePath) => ipcRenderer.invoke('selectVideoForCut', videoFilePath),
  videoInfoForCut: (callback) => ipcRenderer.on('videoInfoForCut', callback),
  cutVideo: (input, output, opts, progressCallback,endCallback,errorCallback) => {
    ffmpegClass.cutVideo(input, output, opts, progressCallback,endCallback,errorCallback);
  },
  killCutVideoCommand: () => {
    ffmpegClass.killCutVideoCommand();
  },

  processVideoForMerge:(input, output, opts, progressCallback,endCallback,errorCallback)=>{
    ffmpegClass.processVideoForMerge(input, output, opts, progressCallback,endCallback,errorCallback);
  },
  mergeVideo:(output,concatFilePath,endCallback,errorCallback)=>{
    ffmpegClass.mergeVideo(output,concatFilePath,endCallback,errorCallback);
  },
  killMergeVideoCommand: () => {
    ffmpegClass.killMergeVideoCommand();
  },
})

contextBridge.exposeInMainWorld('customApi', {
  getLangRes: () => {
    var langList=["bg", "cs", "da", "de", "el", "en", "es", "et", "fi", "fr", "hu", "it", "ja", "ko", "nl", "pl", "pt", "ro", "ru", "sl", "sv", "th", "vi", "zh", "zh-tw"];

    return ipcRenderer.invoke('getLocale')
    .then(data=>{
      var langCode = data;
      if (langCode == "zh-hk"){
          langCode = "zh-tw";
      }
      if(!langList.includes(langCode)){
        if(langCode.indexOf('-')!=-1){
          langCode=langCode.substring(0,langCode.indexOf('-'));
        }
        if(!langList.includes(langCode)){
          langCode="en";
        }
      }
      return require('./locales/'+langCode+'.json');
    })
    .catch((e) => {
      return require('./locales/en.json');
    });
  },
})