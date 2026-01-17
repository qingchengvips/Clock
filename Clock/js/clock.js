
$(function () {

    var retryCount = 0;
    var maxRetries = 10;


    window.addEventListener('error', function (e) {

    });


    function initClock() {
        try {

            if (typeof $ === 'undefined') {
                retryCount++;
                if (retryCount < maxRetries) {
                    setTimeout(initClock, 500);
                }
                return;
            }

            var clock = $('#utility-clock');


            if (!clock || clock.length === 0) {

                var widgetContainer = $('.widget_custom_clock');
                if (widgetContainer.length > 0) {
                    clock = $('<div class="clock" id="utility-clock"></div>');
                    widgetContainer.find('.widget_custom_content.widget-clock .fill').append(clock);
                } else {
                    retryCount++;
                    if (retryCount < maxRetries) {
                        setTimeout(initClock, 500);
                    }
                    return;
                }
            }


            clock.css({
                'display': 'block !important',
                'visibility': 'visible !important',
                'opacity': '1 !important'
            });


            if (document.readyState !== 'complete') {
                retryCount++;
                if (retryCount < maxRetries) {
                    setTimeout(initClock, 500);
                }
                return;
            }

            utilityClock(clock);
        } catch (error) {

            retryCount++;
            if (retryCount < maxRetries) {
                setTimeout(initClock, 500);
            }
        }
    }


    $(window).on('load', function () {

        retryCount = 0;
        initClock();
    });


    setTimeout(initClock, 300);

    function utilityClock(container) {

        if (!container || container.length === 0) {

            return;
        }



        if ($('body').width() <= 960 && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            $('.widget_custom_clock').hide();
            return;
        }


        if (typeof requestAnimationFrame !== 'function') {

            window.requestAnimationFrame = function (callback) {
                return setTimeout(callback, 1000 / 60);
            };
        }

        var dynamic = $(container).find('.dynamic').get(0);
        var hourElement = $(container).find('.hour').get(0);
        var minuteElement = $(container).find('.minute').get(0);
        var secondElement = $(container).find('.second').get(0);


        if (!dynamic) {

            var centre = $(container).find('.centre').get(0);
            if (!centre) {

                var clockFace = $(container).find('.clock-face').get(0);
                if (!clockFace) {

                    clockFace = $('<div class="clock-face"></div>');
                    $(container).append(clockFace);
                }

                centre = $('<div class="centre"></div>');
                $(clockFace).append(centre);
            }

            dynamic = $('<div class="dynamic"></div>');
            $(centre).append(dynamic);
            dynamic = dynamic.get(0);
        }


        if (!hourElement) {
            hourElement = $('<div class="hour"></div>');
            $(dynamic).append(hourElement);
            hourElement = hourElement.get(0);
        }

        if (!minuteElement) {
            minuteElement = $('<div class="minute"></div>');
            $(dynamic).append(minuteElement);
            minuteElement = minuteElement.get(0);
        }

        if (!secondElement) {
            secondElement = $('<div class="second"></div>');
            $(dynamic).append(secondElement);
            secondElement = secondElement.get(0);
        }

        var timeOffset = 0;
        var lastSyncTime = 0;


        function initHighResTime() {

        }


        function getHighResTime() {
            try {
                if (typeof performance !== 'undefined' && performance.now) {
                    return performance.timing.navigationStart + performance.now();
                }
            } catch (error) {

            }
            return Date.now();
        }


        function syncNetworkTime() {

            $.ajax({
                url: '/api/time.php',
                dataType: 'json',
                timeout: 3000,
                success: function (data) {
                    try {
                        if (data && data.code === 200 && data.timestamp) {
                            var localTime = getHighResTime();
                            timeOffset = data.timestamp - localTime;
                            lastSyncTime = localTime;
                            var networkDate = new Date(data.timestamp);
                            console.log('时间同步API调用成功');

                            if (typeof updateCalibrationInfo === 'function') {
                                updateCalibrationInfo('校时成功：后端API | ' + networkDate.toLocaleString());
                            }
                        } else {
                            handleSyncError();
                        }
                    } catch (e) {
                        console.error('时间同步数据处理错误:', e);
                        handleSyncError();
                    }
                },
                error: function (xhr, status, error) {
                    console.error('时间同步API调用失败:', {
                        '状态': status,
                        '错误': error
                    });

                    if (typeof updateCalibrationInfo === 'function') {
                        updateCalibrationInfo('同步失败：后端API');
                    }

                    handleSyncError();
                }
            });
        }


        function handleSyncError() {


            if (typeof updateCalibrationInfo === 'function') {
                updateCalibrationInfo('时间同步失败，使用本地高精度时间');
            }
        }


        window.calibrateClock = function (manualOffset) {
            timeOffset = manualOffset;
            lastSyncTime = getHighResTime();

        };


        initHighResTime();


        function createClockElements() {


            var minute = function (n) {
                return n % 5 == 0 ? minuteText(n) : minuteLine(n);
            }
            var minuteText = function (n) {
                var element = document.createElement('div');
                element.className = 'minute-text';
                element.innerHTML = (n < 10 ? '0' : '') + n;
                position(element, n / 60, 135);
                dynamic.appendChild(element);
            }
            var minuteLine = function (n) {
                var anchor = document.createElement('div');
                anchor.className = 'anchor';
                var element = document.createElement('div');
                element.className = 'element minute-line';
                rotate(anchor, n);
                anchor.appendChild(element);
                dynamic.appendChild(anchor);
            }
            var hour = function (n) {
                var element = document.createElement('div');
                element.className = 'hour-text hour-' + n;
                element.innerHTML = n;
                position(element, n / 12, 105);
                dynamic.appendChild(element);
            }
            var position = function (element, phase, r) {
                var theta = phase * 2 * Math.PI;
                element.style.top = (-r * Math.cos(theta)).toFixed(1) + 'px';
                element.style.left = (r * Math.sin(theta)).toFixed(1) + 'px';
            }
            var rotate = function (element, second) {
                element.style.transform = element.style.webkitTransform = 'rotate(' + (second * 6) + 'deg)';
            }


            try {
                for (var i = 1; i <= 60; i++) minute(i);
                for (var i = 1; i <= 12; i++) hour(i);

                return true;
            } catch (error) {

                return false;
            }
        }


        var animate = function () {

            try {

                var now = Date.now();
                var calibratedTime = new Date(now + timeOffset);


                var seconds = calibratedTime.getSeconds() + calibratedTime.getMilliseconds() / 1000;
                var minutes = calibratedTime.getMinutes() + seconds / 60;
                var hours = calibratedTime.getHours() + minutes / 60;


                var secondDegrees = seconds * 6;
                var minuteDegrees = minutes * 6;
                var hourDegrees = hours * 30;


                if (secondElement) {
                    secondElement.style.transform = 'rotate(' + secondDegrees + 'deg)';
                    secondElement.style.webkitTransform = 'rotate(' + secondDegrees + 'deg)';
                }

                if (minuteElement) {
                    minuteElement.style.transform = 'rotate(' + minuteDegrees + 'deg)';
                    minuteElement.style.webkitTransform = 'rotate(' + minuteDegrees + 'deg)';
                }

                if (hourElement) {
                    hourElement.style.transform = 'rotate(' + hourDegrees + 'deg)';
                    hourElement.style.webkitTransform = 'rotate(' + hourDegrees + 'deg)';
                }


                requestAnimationFrame(animate);
            } catch (error) {


                setTimeout(animate, 1000 / 60);
            }
        };


        function showClock() {

            $('.widget_custom_clock').css({
                'display': 'block !important',
                'visibility': 'visible !important',
                'opacity': '1 !important',
                'position': 'relative !important',
                'z-index': '9999 !important'
            });


            $(container).css({
                'display': 'block !important',
                'visibility': 'visible !important',
                'opacity': '1 !important'
            });
        }


        if (createClockElements()) {
            showClock();


            setInterval(syncNetworkTime, 5 * 60 * 1000);

            setTimeout(syncNetworkTime, 1000);


            animate();

        } else {

        }
    }
});