new Vue({
    el: "#body-container",
    data() {
        return {
            langRes:null,

            tabActiveName: 'cut',

            videoExtArr:['mp4','avi','mkv','mov','flv','swf','mpeg','mpg','ts'],
            // audioExtArr:['mp3','wav','aiff','au','wma','flac','ogg','aac','ra','rm'],
            // imageExtArr:['jpg','jpeg','png','gif','bmp','tiff'],
            videoBitrateArr:[500,1000,2000,3000,4000,5000,6000,7000,8000,9000,10000,12000,14000,16000,18000,20000],
            audioBitrateArr:[64,96,128,160,192,256,320],
            frameRateArr:[18,20,24,25,30,48,50,60],
            resolutionArr:{
                "320x240":"320x240",
                "480x320":"480x320",
                "640x480":"640x480",
                "720x404":"720x404(480P 16:9)",
                "720x480":"720x480(480P)",
                "720x567":"720x567",
                "1024x576":"1024x576(16:9)",
                "576x1024":"570x1024(9:16)",
                "1280x720":"1280x720(720P)",
                "720x1280":"720x1280(720P)",
                "1920x1080":"1920x1080(1080P)",
                "1080x1920":"1080x1920(1080P)",
                "2560x1440":"2560x1440(2K)",
                "1440x2560":"1440x2560(2K)",
                "3840x2160":"3840x2160(4K)",
                "2160x3840":"2160x3840(4K)"
            },

            tableLoading:false,

            videoSpeedArr:[4,2,1,0.5,0.25],
            videoElement:null, //video播放器元素对象
            videoPath:null, //视频路径
            videoDuration:0, //视频时常
            videoFrameRate:null, //视频帧速率
            videoPlayTime:0, //视频当前播放的时长
            videoSliderValue:0, //视频播放进度条值，值为videoPlayTime*1000
            videoPlaying:false, //视频是否在播放中
            videoSpeed:1, //视频播放倍速
            cutOptions:{
                cutting:false,
                speed:1,
                startTime:null,
                endTime:null,
                volume:1,
                noAudio:false,
                outputFileFullPath:null,
                cutPercent:0
            },

            mergeData:[],
            mergeOptions:{
                mergeIng:false,
                speed:1,
                videoBitrate:4000,
                audioBitrate:128,
                frameRate:25,
                resolution:'1024x576',
                volume:1,
                noAudio:false,
                outputFileFullPath:null,
                mergeVideoTempDirName:'MergeVideoTempDir',
                mergeVideoTempDirPath:'',
                mergePercent:0,
                concatFileContent:''
            },
        }
    },
    computed:{
        //视频播放时长时分秒字符串
        videoPlayDurationStr(){
            var time=this.videoPlayTime>this.videoDuration?this.videoDuration:this.videoPlayTime
            return this.transDurationStr(time);
        },
        videoTotalDurationStr(){
            return this.transDurationStr(this.videoDuration);
        },
        videoSliderMax(){
            return parseInt(this.videoDuration*1000,10)
        },

        fileMergePercent(){
            if(this.mergeData.length==0)
                return 0;
            var filterData = this.mergeData.filter(item => {
                return item.status == 2 || item.status == 3
            });
            
            return parseInt((filterData.length/this.mergeData.length)*100,10);
        }
    },
    mounted() {
        setTimeout(()=>{
            document.title = this.lang("title");
        },100)

        electronAPI.videoInfoForCut((event, playParams) => {
            console.log(playParams);
            if(this.videoPath!=null)
                this.getVideoElement().currentTime=0;
            this.videoPath=playParams.videoSource;
            this.videoDuration=playParams.duration;
            this.videoFrameRate=Number(playParams.frameRate);
            this.videoPlayTime=0;
            this.videoSliderValue=0;
            this.videoPlaying=false;
        });
    },
    methods: {
        isNullOrEmpty(str) {
            if (str == null || typeof str == "undefined" || String(str).trim() == "")
                return true;
            else
                return false;
        },

        toNum(str){
            if(this.isNullOrEmpty(str) || isNaN(str))
                return null;
            else
                return Number(str);
        },

        //multilingual
        getLangStr(key){
            var keyArr=key.split('.');
            var langObj=this.langRes[keyArr[0]];
            for(var i=1;i<keyArr.length;i++){
                langObj=langObj[keyArr[i]];
            }
            return langObj;
        },
        lang(key){
            if(this.langRes==null){
                window.customApi.getLangRes()
                .then(data=>{
                    this.langRes=data;
                    return this.getLangStr(key);
                })
                .catch((e) => {
                    return key;
                });
            }else{
                return this.getLangStr(key);
            }
        },

        dialogOpenFile(type){
            var extArr=[];
            var multiSelections;
            if(type=='cutVideo'){
                extArr=['mp4'];
                multiSelections=false;
            }else{
                extArr=this.videoExtArr;
                multiSelections=true;
            }
            electronAPI.dialogOpenFile(extArr,multiSelections)
            .then(filePaths=>{
                if(filePaths!=null && filePaths.length>0){
                    if(type=='cutVideo'){
                        electronAPI.selectVideoForCut(filePaths[0]);
                    }else{
                        this.tableLoading=true;
                        setTimeout(()=>{
                            for(var i=0;i<filePaths.length;i++){
                                this.mergeData.push({
                                    sourcePath:filePaths[i],
                                    sourceSize:null,
                                    sourceDuration:null,
                                    sourceVideoBitrate:null,
                                    sourceAudioBitrate:null,
                                    sourceFrameRate:null,
                                    sourceWidth:null,
                                    sourceHeight:null,
                                    processed:false
                                });
    
                                electronAPI.getVideoOrAudioMetaData(filePaths[i],(metaData)=>{
                                    var filterData = this.mergeData.filter(item => {
                                        return item.sourcePath == metaData.format.filename
                                    });
                                    filterData.forEach(item=>{
                                        item.sourceSize=metaData.format.size;
                                        item.sourceDuration=metaData.format.duration;
                                        for(var k=0;k<metaData.streams.length;k++){
                                            if(metaData.streams[k].codec_type=='video'){
                                                item.sourceVideoBitrate=metaData.streams[k].bit_rate;
                                                item.sourceFrameRate=Number(eval(metaData.streams[k].r_frame_rate).toFixed(0));
                                                item.sourceWidth=metaData.streams[k].width;
                                                item.sourceHeight=metaData.streams[k].height;
                                            }else if(metaData.streams[k].codec_type=='audio'){
                                                item.sourceAudioBitrate=metaData.streams[k].bit_rate;
                                            }
                                        }
                                    });
                                    console.log(metaData)
                                });
                            }
                            this.tableLoading=false;
                        },50);
                    }
                }
            });
        },

        async dialogOpenDirectory(dirType){
            const dirPaths = await window.electronAPI.dialogOpenDirectory()
            if(dirPaths==null || dirPaths=='')
                return;
            if(dirType=="curOutput"){
                this.cutOptions.outputPath = dirPaths;
                this.$refs['cutOptionsForm'].clearValidate(['outputPath']);
            }else if(dirType=="mergeOutput"){
                this.mergeOptions.outputPath = dirPaths;
                this.$refs['mergeOptionsForm'].clearValidate(['outputPath']);
            }else if(dirType=="mergeInput"){
                var mergeData = window.electronAPI.getFilesFromDir(dirPaths,this.videoExtArr);
                if(mergeData!=null && mergeData.length>0){
                    this.tableLoading=true;
                    setTimeout(()=>{
                        for(var i=0;i<mergeData.length;i++){
                            this.mergeData.push({
                                sourcePath:mergeData[i].filePath,
                                sourceSize:null,
                                sourceDuration:null,
                                sourceVideoBitrate:null,
                                sourceAudioBitrate:null,
                                sourceFrameRate:null,
                                sourceWidth:null,
                                sourceHeight:null,
                                processed:false
                            });

                            electronAPI.getVideoOrAudioMetaData(mergeData[i].filePath,(metaData)=>{
                                var filterData = this.mergeData.filter(item => {
                                    return item.sourcePath == metaData.format.filename
                                });
                                filterData.forEach(item=>{
                                    item.sourceSize=metaData.format.size;
                                    item.sourceDuration=metaData.format.duration;
                                    for(var k=0;k<metaData.streams.length;k++){
                                        if(metaData.streams[k].codec_type=='video'){
                                            item.sourceVideoBitrate=metaData.streams[k].bit_rate;
                                            item.sourceFrameRate=Number(eval(metaData.streams[k].r_frame_rate).toFixed(0));
                                            item.sourceWidth=metaData.streams[k].width;
                                            item.sourceHeight=metaData.streams[k].height;
                                        }else if(metaData.streams[k].codec_type=='audio'){
                                            item.sourceAudioBitrate=metaData.streams[k].bit_rate;
                                        }
                                    }
                                });
                            });
                        }
                        this.tableLoading=false;
                    },50);
                }
            }
        },

        renameForNewFile(filePath){
            if(electronAPI.fileExists(filePath)){
                return this.renameForNewFile(filePath.replace(".","(1)."));
            }
            return filePath;
        },

        newFormatChange(e){
            this.mergeOptions.newFormat=e;
            for(var i=0;i<this.mergeData.length;i++){
                this.mergeData[i].newFormat=e;
            }
        },
        
        volumeTooltip(val){
            return parseInt(val*100,10)+'%';
        },

        getVideoElement(){
            if(this.videoElement==null)
                this.videoElement=document.getElementById("video");
            return this.videoElement;
        },
        transDurationStr(duration){
            var durationInt=parseInt(duration,10);
            var durationStr=duration.toFixed(3)+"";
            var hour=parseInt(durationInt/(60*60),10)
            var minute=parseInt((durationInt%(60*60))/60,10)
            var second=parseInt(durationInt%60,10)
            return (hour<10?"0"+hour:hour)+":"+
                (minute<10?"0"+minute:minute)+":"+
                (second<10?"0"+second:second)+
                durationStr.substring(durationStr.indexOf('.'));
        },
        videoPlayPause(){
            if (this.getVideoElement().paused){
                this.videoPlaying=true;
                this.getVideoElement().play();
            } else {
                this.videoPlaying=false;
                this.getVideoElement().pause();
            }
        },
        videoSpeedChange(speed){
            this.videoSpeed=speed;
            this.getVideoElement().playbackRate=speed;
            document.querySelectorAll('.el-tooltip__popper').forEach(item=>{
                item.style.display='none';
            });
        },
        videoPlayTimeUpdate(){
            this.videoPlayTime=this.getVideoElement().currentTime;
            this.videoSliderValue=parseInt(this.videoPlayTime*1000,10);
        },
        videoSliderInput(e){
            if(e!=parseInt(this.videoPlayTime*1000,10)){
                this.getVideoElement().pause();
            }
        },
        videoSliderChange(e){
            if(this.videoPath.indexOf('http://')!=-1){
                this.videoPath="http://127.0.0.1:8888?startTime="+(e/1000);
            }
            this.getVideoElement().currentTime=e/1000;
            this.getVideoElement().play();
        },
        videoSliderFormatTooltip(val){
            return this.transDurationStr(val/1000);
        },
        prevFrame(){
            this.getVideoElement().currentTime-=Number((1/this.videoFrameRate).toFixed(3));
            this.getVideoElement().pause();
        },
        nextFrame(){
            this.getVideoElement().currentTime+=Number((1/this.videoFrameRate).toFixed(3));
            this.getVideoElement().pause();
        },
        setCutStartTime(){
            if(!this.cutOptions.cutting){
                this.cutOptions.startTime=this.videoPlayDurationStr;
                this.$refs['cutOptionsForm'].clearValidate(['startTime']);
            }else{
                this.$message.warning(this.lang('settingTimeTip1'));
            }
        },
        setCutEndTime(){
            if(!this.cutOptions.cutting){
                this.cutOptions.endTime=this.videoPlayDurationStr;
                this.$refs['cutOptionsForm'].clearValidate(['endTime']);
            }else{
                this.$message.warning(this.lang('settingTimeTip1'));
            }
        },
        goCut(){
            if(this.cutOptions.cutting){
                electronAPI.killCutVideoCommand();
                this.cutOptions.cutting=false;
                this.cutOptions.cutPercent=0;
                setTimeout(() => {
                    electronAPI.deleteFile(this.cutOptions.outputFileFullPath);
                }, 1000);
                return;
            }
            this.$refs['cutOptionsForm'].validate((valid) => {
                if (valid) {
                    var startTimeArr = this.cutOptions.startTime.split(':');
                    var startTime=Number(startTimeArr[0]) * 3600 + Number(startTimeArr[1]) * 60 + Number(startTimeArr[2]);
                    var endTimeArr = this.cutOptions.endTime.split(':');
                    var endTime=Number(endTimeArr[0]) * 3600 + Number(endTimeArr[1]) * 60 + Number(endTimeArr[2]);
                    if(startTime>=endTime){
                        this.$message.error(this.lang('settingTimeTip2'));
                        return;
                    }
                    
                    electronAPI.diaglogSaveFile(this.videoExtArr)
                    .then(filePath=>{
                        if(this.isNullOrEmpty(filePath))return;
                        this.cutOptions.cutting=true;
                        
                        this.cutOptions.outputFileFullPath=filePath;

                        var opts={
                            seekInput:startTime,
                            duration:endTime-startTime,
                            speed:this.cutOptions.speed,
                            volume:this.cutOptions.volume,
                            noAudio:this.cutOptions.noAudio
                        };
                        electronAPI.cutVideo(this.videoPath, this.cutOptions.outputFileFullPath, opts,
                        (progress)=>{
                            if(this.isNullOrEmpty(progress.percent))return;
                            this.cutOptions.cutPercent=progress.percent.toFixed(1);
                        },()=>{
                            setTimeout(() => {
                                this.cutOptions.cutPercent=100;
                                this.$alert(this.lang('cutOver'), this.lang('tip'), {
                                    confirmButtonText: this.lang('ok'),
                                    callback: action => {
                                        this.cutOptions.cutPercent=0;
                                        this.cutOptions.cutting=false;
                                    }
                                });
                            }, 800);
                        },()=>{
                            this.cutOptions.cutPercent=0;
                            this.cutOptions.cutting=false;
                            this.$message.error(this.lang('cutFailed'));
                            setTimeout(() => {
                                electronAPI.deleteFile(this.cutOptions.outputFileFullPath);
                            }, 1000);
                        });
                    });;
                }
            });
        },

        delMergeDataRow(scope){
            if(this.mergeOptions.mergeIng){
                return;
            }
            this.mergeData.splice(scope.$index, 1);
        },
        moveUpMergeDataRow(scope){
            if(scope.$index==0 || this.mergeOptions.mergeIng){
                return;
            }
            this.mergeData[scope.$index-1] = this.mergeData.splice(scope.$index, 1, this.mergeData[scope.$index-1])[0];
        },
        moveDownMergeDataRow(scope){
            if(scope.$index==this.mergeData.length-1 || this.mergeOptions.mergeIng){
                return;
            }
            this.mergeData[scope.$index+1] = this.mergeData.splice(scope.$index, 1, this.mergeData[scope.$index+1])[0];
        },
        killMergeVideoCommand(){
            electronAPI.killMergeVideoCommand();
            this.mergeOptions.mergeIng=false;
            this.mergeData.forEach(t=>{
                t.processed=false;
            });
            this.mergeOptions.mergePercent=0;
            setTimeout(() => {
                electronAPI.deleteDir(this.mergeOptions.mergeAudioTempDirPath);
            }, 1000);
        },
        goMerge(){
            if(this.mergeOptions.mergeIng){
                this.killMergeVideoCommand();
                return;
            }

            electronAPI.diaglogSaveFile(this.videoExtArr)
            .then(filePath=>{
                if(this.isNullOrEmpty(filePath))return;
                this.mergeOptions.outputFileFullPath=filePath.replace(/\\/g,"/");
                this.mergeOptions.mergeVideoTempDirPath=
                    this.mergeOptions.outputFileFullPath.substring(0,this.mergeOptions.outputFileFullPath.lastIndexOf('/'))
                    +"/"+this.mergeOptions.mergeVideoTempDirName;
                electronAPI.makeDir(this.mergeOptions.mergeVideoTempDirPath);

                this.mergeOptions.mergeIng=true;
                this.mergeOptions.concatFileContent='';
                this.processVideoForMerge();
            });
        },
        processVideoForMerge(){
            for(var i=0;i<this.mergeData.length;i++){
                if(!this.mergeOptions.mergeIng)
                    return;
                
                if(this.mergeData[i].processed){
                    continue;
                }

                var tempVideoPath=this.mergeOptions.mergeVideoTempDirPath+'/'+i+'.ts';
                electronAPI.processVideoForMerge(this.mergeData[i].sourcePath, tempVideoPath, {
                    duration:this.mergeData[i].sourceDuration,
                    speed:this.mergeOptions.speed,
                    videoBitrate:this.mergeOptions.videoBitrate,
                    audioBitrate:this.mergeOptions.audioBitrate,
                    frameRate:this.mergeOptions.frameRate,
                    resolution:this.mergeOptions.resolution,
                    volume:this.mergeOptions.volume,
                    noAudio:this.mergeOptions.noAudio
                },(progress)=>{
                    if(this.isNullOrEmpty(progress.percent))return;
                    var percentData=[0,0];
                    for(var j=0;j<this.mergeData.length;j++){
                        if(j<i){
                            percentData[0]+=Number(this.mergeData[j].sourceSize);
                        }else if(j==i){
                            percentData[0]+=parseInt(Number(this.mergeData[j].sourceSize)*progress.percent/100,10);
                        }
                        percentData[1]+=Number(this.mergeData[j].sourceSize);
                    }
                    percentData[1]+=10000;
                    this.mergeOptions.mergePercent=((percentData[0]/percentData[1])*100).toFixed(1);
                },()=>{
                    this.mergeData[i].processed=true;
                    this.mergeOptions.concatFileContent+=(i!=0?'|':'')+tempVideoPath;
                    var filterData = this.mergeData.filter(item => {
                        return !item.processed
                    });
                    if(filterData.length==0){
                        this.mergeVideo();
                    }else{
                        this.processVideoForMerge();
                    }
                },()=>{
                    this.$message.error(this.lang('mergeFailed'));
                    this.killMergeVideoCommand();
                });

                break;
            }
        },
        mergeVideo(){
            electronAPI.mergeVideo(this.mergeOptions.outputFileFullPath,this.mergeOptions.concatFileContent,()=>{
                this.mergeOptions.mergePercent=100;
                this.$alert(this.lang('mergeOver'), this.lang('tip'), {
                    confirmButtonText: this.lang('ok'),
                    callback: action => {
                        this.mergeOptions.mergePercent=0;
                        this.mergeOptions.mergeIng=false;
                        electronAPI.deleteDir(this.mergeOptions.mergeVideoTempDirPath);
                    }
                });
            },()=>{
                this.$message.error(this.lang('mergeFailed'));
                this.killMergeVideoCommand();
            });
        },

        openBrowser(url){
            window.electronAPI.openBrowser(url);
        },

        openPath(url){
            window.electronAPI.openPath(url);
        }
    }
});