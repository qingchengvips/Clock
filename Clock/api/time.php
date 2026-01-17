<?php
// 设置默认时区
date_default_timezone_set('UTC');
header('Content-Type: application/json; charset=utf-8');

// 允许的域名列表（生产环境）
$allowed_domains = array(
    // 'yourdomain.com',  // 取消注释并添加您的域名
    // 'www.yourdomain.com'
);

// 时间校准API配置
$time_api_config = array(
    'url' => 'https://cn.apihz.cn/api/time/getapi.php?id=你的ID&key=你的KEY&type=2',    // 替换为你自己的API
    // 'API申请' => 'https://www.apihz.cn/',
    'timeout' => 3,
    'cache_duration' => 300, // 缓存时间（秒）
);

// 日志文件路径
$log_file = __DIR__ . '/time_api.log';

// 日志记录函数
function log_message($message, $level = 'info')
{
    global $log_file;
    $timestamp = date('Y-m-d H:i:s');
    $log_entry = "[$timestamp] [$level] $message\n";
    error_log($log_entry, 3, $log_file);
}

// 处理CORS
function handle_cors()
{
    global $allowed_domains;

    $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';

    // 限制来源域名
    if ($origin) {
        $origin_host = parse_url($origin, PHP_URL_HOST);
        if (in_array($origin_host, $allowed_domains)) {
            header('Access-Control-Allow-Origin: ' . $origin);
        }
    }

    header('Access-Control-Allow-Methods: GET');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Max-Age: 3600'); // 缓存CORS设置1小时
}

// 域名验证
function validate_domain()
{
    global $allowed_domains;

    $referer = isset($_SERVER['HTTP_REFERER']) ? $_SERVER['HTTP_REFERER'] : '';
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
    $client_ip = $_SERVER['REMOTE_ADDR'];

    // 检查是否为开发环境
    $is_development = false;
    // 只有当allowed_domains为空且请求来自本地IP时，才视为开发环境
    if (empty($allowed_domains) && in_array($client_ip, array('127.0.0.1', '::1'))) {
        $is_development = true;
    }

    // 验证来源
    $valid_domain = false;

    // 检查Referer
    if (!empty($referer)) {
        $referer_parts = parse_url($referer);
        if (isset($referer_parts['host']) && (in_array($referer_parts['host'], $allowed_domains) || $is_development)) {
            $valid_domain = true;
        }
    }

    // 检查Origin
    if (!empty($origin)) {
        $origin_parts = parse_url($origin);
        if (isset($origin_parts['host']) && (in_array($origin_parts['host'], $allowed_domains) || $is_development)) {
            $valid_domain = true;
        }
    }

    // 如果没有Referer和Origin头，但处于开发环境，也允许访问
    if (!$valid_domain && $is_development) {
        $valid_domain = true;
    }

    // 记录验证结果
    if (!$valid_domain) {
        log_message("Domain validation failed: Referer=$referer, Origin=$origin, IP=$client_ip", 'warning');
    }

    return $valid_domain;
}

// 调用外部时间API
function call_time_api()
{
    global $time_api_config;

    // 缓存文件路径
    $cache_file = __DIR__ . '/time_cache.json';

    // 检查缓存是否有效
    if (file_exists($cache_file)) {
        $cache_data = json_decode(file_get_contents($cache_file), true);
        if ($cache_data && time() - $cache_data['cached_at'] < $time_api_config['cache_duration']) {
            log_message('Using cached time data');
            return $cache_data['api_response'];
        }
    }

    // 检查是否支持HTTPS
    if (!in_array('https', stream_get_wrappers())) {
        log_message('HTTPS wrapper not supported', 'warning');
        return array('error' => 'HTTPS wrapper not supported');
    }

    try {
        // 创建超时上下文
        $context = stream_context_create(array(
            'http' => array(
                'timeout' => $time_api_config['timeout'],
                'method' => 'GET',
                'ignore_errors' => true
            ),
            'ssl' => array(
                'verify_peer' => false,
                'verify_peer_name' => false
            )
        ));

        // 获取响应
        $response = @file_get_contents($time_api_config['url'], false, $context);

        if ($response === false) {
            $error = error_get_last();
            $error_msg = $error ? $error['message'] : 'Unknown error';
            log_message('Failed to fetch time data: ' . $error_msg, 'error');
            return array('error' => 'Failed to fetch time data');
        }

        // 解析响应
        $api_response = json_decode($response, true);

        if (!is_array($api_response)) {
            log_message('Invalid JSON response: ' . substr($response, 0, 100), 'error');
            return array('error' => 'Invalid API response');
        }

        // 缓存响应
        $cache_data = array(
            'api_response' => $api_response,
            'cached_at' => time()
        );
        file_put_contents($cache_file, json_encode($cache_data));

        log_message('Successfully fetched and cached time data');
        return $api_response;
    } catch (Exception $e) {
        log_message('Exception when calling time API: ' . $e->getMessage(), 'error');
        return array('error' => $e->getMessage());
    }
}

// 获取当前服务器时间（带时区）
function get_server_time()
{
    $timezone = new DateTimeZone('Asia/Shanghai'); // 使用上海时区
    $current_time = new DateTime('now', $timezone);
    return $current_time;
}

// 主函数
function main()
{
    // 记录请求
    log_message('API request received from ' . $_SERVER['REMOTE_ADDR']);

    handle_cors();

    // 域名验证
    if (!validate_domain()) {
        http_response_code(403);
        $response = array(
            'code' => 403,
            'msg' => 'Access denied: Invalid domain'
        );
        log_message('Access denied for ' . $_SERVER['REMOTE_ADDR'], 'warning');
        echo json_encode($response);
        return;
    }

    // 调用外部时间API
    $api_response = call_time_api();

    // 获取服务器时间作为回退
    $server_time = get_server_time();
    $server_time_str = $server_time->format('Y-m-d H:i:s');
    $server_timestamp = $server_time->getTimestamp() * 1000; // 转换为毫秒

    if (isset($api_response['error'])) {
        // API调用失败，返回当前服务器时间
        log_message('Using server time fallback: ' . $api_response['error'], 'warning');
        $response = array(
            'code' => 200,
            'msg' => $server_time_str,
            'timestamp' => $server_timestamp,
            'warning' => 'Using server time fallback: ' . $api_response['error']
        );
        echo json_encode($response);
        return;
    }

    // 检查API响应格式
    if (isset($api_response['code']) && $api_response['code'] == 200 && isset($api_response['msg'])) {
        $time_str = $api_response['msg'];
        $timestamp = strtotime($time_str) * 1000; // 转换为毫秒

        // 验证时间戳是否合理
        $now = time() * 1000;
        $time_diff = abs($timestamp - $now);

        if ($time_diff > 300 * 1000) { // 如果时间差超过5分钟
            log_message('API time is significantly different from server time (diff: ' . ($time_diff / 1000) . 's)', 'warning');
            // 仍返回API时间，但添加警告
            $response = array(
                'code' => 200,
                'msg' => $time_str,
                'timestamp' => $timestamp,
                'warning' => 'API time differs significantly from server time'
            );
        } else {
            // 正常情况
            $response = array(
                'code' => 200,
                'msg' => $time_str,
                'timestamp' => $timestamp
            );
        }

        log_message('API time returned: ' . $time_str);
        echo json_encode($response);
        return;
    }

    // 响应格式错误，返回当前服务器时间
    log_message('API response format error, using server time', 'warning');
    $response = array(
        'code' => 200,
        'msg' => $server_time_str,
        'timestamp' => $server_timestamp,
        'warning' => 'Using server time fallback: Invalid API response format'
    );
    echo json_encode($response);
}

// 执行主函数
main();
