const os = require('os');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const http = require('http');

module.exports = class FfmpegClass {
    constructor(props) {
        this._cutVideoCommand;
        this._videoSupperCommand;
        this._videoServer;
        this._videoSourceInfo;

        this._mergeVideoCommand;

        this.setFfmpegPath();
    }

    set videoSourceInfo(info) {
        this._videoSourceInfo = info;
    }

    get videoSourceInfo() {
        return this._videoSourceInfo;
    }

    setFfmpegPath() {
        const platform = os.platform()
        const arch = os.arch()
        const basePath = path.resolve(
            __dirname.replace('app.asar', 'app.asar.unpacked'),
            'bin',
            platform,
            // arm64 is limit supported only for macOS
            platform === 'darwin' && arch === 'arm64'
            ? 'arm64'
            : 'x64',
        )
        var name='ffmpeg';
        var binPath = path.resolve(
            basePath,
            platform === 'win32' ? `${name}.exe` : name,
        )
        .replace(/\\/g,"/")
        .replace('/src/js/bin/','/bin/');
        ffmpeg.setFfmpegPath(binPath);
    }

    getVideoOrAudioMetaData(videoPath,callback){
        ffmpeg(videoPath).ffprobe((err, data) => {
            //console.log(err)
            if(err==null && callback!=null){
                callback(data);
            }
        });
    }

    cutVideo(input, output, opts, progressCallback,endCallback,errorCallback) {
        try{
            this._cutVideoCommand = ffmpeg(input)
                .seekInput(opts.seekInput)
                .duration(Number((opts.duration/opts.speed).toFixed(3)))
            if(opts.speed!=1){
                this._cutVideoCommand = this._cutVideoCommand.videoFilters('setpts='+(1/opts.speed).toFixed(2)+'*PTS');
                if(opts.speed==0.25)
                    this._cutVideoCommand = this._cutVideoCommand.audioFilters('atempo=0.5,atempo=0.5');
                else if(opts.speed==4)
                    this._cutVideoCommand = this._cutVideoCommand.audioFilters('atempo=2,atempo=2');
                else
                    this._cutVideoCommand = this._cutVideoCommand.audioFilters('atempo='+opts.speed);
            }
            this._cutVideoCommand = this._cutVideoCommand
                .on('start', function (commandLine) {
                    console.log('Cut start: ' + commandLine);
                })
                .on('progress', function (progress) {
                    console.log('Processing: ' + progress.percent + '% done');
                    if(progressCallback!=null){
                        progressCallback(progress);
                    }
                })
                .on('end', function (stdout, stderr) {
                    console.log('Cut succeeded!');
                    if(endCallback!=null){
                        endCallback();
                    }
                })
                .on('error', function (err, stdout, stderr) {
                    console.log('Cut error: ', err);
                    if(errorCallback!=null){
                        errorCallback();
                    }
                })
                .save(output);
        }catch(e){
            console.log(e);
            if(errorCallback!=null){
                errorCallback();
            }
        }
    }
    killCutVideoCommand() {
        if (this._cutVideoCommand) {
            this._cutVideoCommand.kill();
        }
    }
    videoSupport(videoPath) {
        let p = new Promise((resolve, reject) => {
            this._videoSupperCommand = ffmpeg(videoPath).ffprobe((err, data) => {
                //console.log(data)
                if (err) {
                    reject(err);
                    return;
                }
                var streams = data.streams;
                var checkResult = {
                    videoCodecSupport: false,
                    audioCodecSupport: false,
                    duration: data.format.duration,
                    frameRate: null
                }
                if (streams) {
                    streams.map((value) => {
                        // mp4, webm, ogg
                        if (value.codec_type == 'video' && (value.codec_name == 'h264' || 
                        value.codec_name == 'vp8' || value.codec_name == 'theora')) {
                            checkResult.videoCodecSupport = true;

                            checkResult.frameRate=Number(eval(value.r_frame_rate).toFixed(0));
                        }
                        if (value.codec_type == 'audio' && (value.codec_name == 'aac' || 
                        value.codec_name == 'vorbis')) {
                            checkResult.audioCodecSupport = true;
                        }
                    })
                }
                resolve(checkResult)
            });
        });
        return p;
    }
    createVideoServer() {
        var getParam = function(url, key) {
            var re = new RegExp("[&,?]" + key + "=([^\\&]*)", "i");
            var r = re.exec(url);
            if (r != null) {
                return decodeURIComponent(r[1]);
            }
            return null;
        };

        if (!this._videoServer && this.videoSourceInfo) {
            this._videoServer = http.createServer((request, response) => {
                console.log("on request", request.url);
                var startTime = parseInt(getParam(request.url, "startTime"));
                let videoCodec = this.videoSourceInfo.checkResult.videoCodecSupport ? 'copy' : 'libx264';
                let audioCodec = this.videoSourceInfo.checkResult.audioCodecSupport ? 'copy' : 'aac';
                this.killFfmpegCommand();
                this._videoSupperCommand = ffmpeg()
                    .input(this.videoSourceInfo.videoSourcePath)
                    .nativeFramerate()
                    .videoCodec(videoCodec)
                    .audioCodec(audioCodec)
                    .format('mp4')
                    .seekInput(startTime)
                    .outputOptions(
                        '-movflags', 'frag_keyframe+empty_moov+faststart',
                        '-g', '18')
                    .on('progress', function (progress) {
                        console.log('time: ' + progress.timemark);
                    })
                    .on('error', function (err) {
                        console.log('An error occurred: ' + err.message);
                    })
                    .on('end', function () {
                        console.log('Processing finished !');
                    })
                let videoStream = this._ffmpegCommand.pipe();
                videoStream.pipe(response);
            }).listen(8888);
        }
    }
    killVideoSupperCommand() {
        if (this._videoSupperCommand) {
            this._videoSupperCommand.kill();
        }
    }

    processVideoForMerge(input, output, opts, progressCallback,endCallback,errorCallback){
        this._mergeVideoCommand = ffmpeg()
        .input(input)
        .videoCodec('libx264') //libx264，libvpx，libtheora，libxvid，libvpx-vp9
        .audioCodec('aac') //libmp3lame，libfaac，libvorbis，libfdk_aac
        .fps(opts.frameRate)
        .videoBitrate(opts.videoBitrate)
        .audioBitrate(opts.audioBitrate)
        .size(opts.resolution)
        .autopad()
        .on('progress', function (progress) {
          //console.log('Processing: ' + progress.percent + '% done');
          if(progressCallback!=null){
            progressCallback(progress);
          }
        })
        .on('end', function (stdout, stderr) {
          console.log('Processing succeeded!');
          if(endCallback!=null){
            endCallback();
          }
        })
        .on('error', function (err, stdout, stderr) {
          console.log('Processing error: ', err);
          if(errorCallback!=null){
            errorCallback();
          }
        })
        .save(output);
    }
    mergeVideo(output,concatFileContent,endCallback,errorCallback){
        this._mergeVideoCommand = ffmpeg()
        .outputOptions(['-i','concat:'+concatFileContent,'-codec','copy'])
        .on('end', function (stdout, stderr) {
          console.log('Merge succeeded!');
          if(endCallback!=null){
            endCallback();
          }
        })
        .on('error', function (err, stdout, stderr) {
          console.log('Merge error: ', err);
          if(errorCallback!=null){
            errorCallback();
          }
        })
        .save(output);

    }
    killMergeVideoCommand() {
        if (this._mergeVideoCommand) {
            this._mergeVideoCommand.kill();
        }
    }
}