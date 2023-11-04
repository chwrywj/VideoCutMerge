const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const path = require('path');
const FfmpegClass = require('./src/js/FfmpegClass');

let ffmpegClass = new FfmpegClass();

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 750,
        //show: false,
        icon: path.join(__dirname,"./src/img/icon.png"),
		webPreferences: {
			preload: path.join(__dirname, 'preload.js')
		}
    })
    
    // mainWindow.maximize()
    // mainWindow.show()

    mainWindow.setMenu(null)

    mainWindow.loadFile('src/index.html')

    //mainWindow.webContents.openDevTools()

    mainWindow.on('closed', function () {
        mainWindow = null
    })
}

app.whenReady().then(() => {
    ipcMain.handle('getLocale', () => {
        //return "en";
        return app.getLocale()
    })

    ipcMain.handle('dialog:openFile', async (event, extnameArr, multiSelections) => {
        var properties=['openFile'];
        if(multiSelections==null || multiSelections)
            properties.push('multiSelections');
        const { canceled, filePaths } = await dialog.showOpenDialog({
            properties: properties,
            filters:[
                { name: 'Extensions', extensions: extnameArr }
            ]
        })
        if (!canceled) {
            return filePaths
        }
    })
  
    ipcMain.handle('dialog:openDirectory', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog({
            properties: ['openDirectory']
        })
        if (!canceled) {
            return filePaths[0]
        }
    })

    ipcMain.handle('dialog:saveFile', async (event, extnameArr) => {
        var filters=[];
        extnameArr.forEach(item => {
            filters.push({
                name:item.toLocaleUpperCase(),
                extensions:[item]
            });
        });
        const { canceled, filePath } = await dialog.showSaveDialog({
            filters:filters
        })
        if (!canceled) {
            return filePath
        }
    })
    
    ipcMain.handle('selectVideoForCut', (event, videoFilePath) => {
        ffmpegClass.videoSupport(videoFilePath).then((checkResult) => {
            ffmpegClass.killVideoSupperCommand();
            let playParams = {};
            playParams.duration = checkResult.duration
            playParams.frameRate = checkResult.frameRate
            if (checkResult.videoCodecSupport && checkResult.audioCodecSupport) {
                playParams.type = "native";
                playParams.videoSource = videoFilePath;
            }
            if (!checkResult.videoCodecSupport || !checkResult.audioCodecSupport) {
                ffmpegClass.videoSourceInfo = { videoSourcePath: videoFilePath, checkResult: checkResult };
                ffmpegClass.createVideoServer();
    
                playParams.type = "stream";
                playParams.videoSource = "http://127.0.0.1:8888?startTime=0";
            }
            mainWindow.webContents.send('videoInfoForCut', playParams);
        }).catch((err) => {
            console.log(err)
            // const options = {
            //     type: 'info',
            //     title: 'Error',
            //     message: "It is not a video file!",
            //     buttons: ['OK']
            // }
            // dialog.showMessageBox(options, function (index) {
            //     console.log("showMessageBox", index);
            // })
        })
    });
    
    createWindow()

    app.on('activate', function () {
        if (mainWindow === null) {
            createWindow()
        }
    })
})

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})