<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:atom="http://www.w3.org/2005/Atom">
<xsl:output method="html" encoding="utf-8" indent="yes"/>
<xsl:template match="/">
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title><xsl:value-of select="rss/channel/title"/> · RSS 订阅</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#1a1a1a;color:#f5f5f5;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;line-height:1.7}.wrap{max-width:720px;margin:0 auto;padding:48px 20px 80px}h1{font-size:34px;margin:0 0 8px}.sub{color:#999;font-size:15px}.box{background:#242424;border:1px solid #3a3a3a;border-radius:12px;padding:24px;margin:28px 0}.box h2{margin:0 0 10px;font-size:19px}.box p{color:#bbb;margin:0 0 12px;font-size:14px}.url{word-break:break-all;background:#111;border:1px solid #3a3a3a;border-radius:8px;padding:12px 14px;font-family:monospace;font-size:14px;color:#ffe600}ol{padding-left:20px;color:#ccc;font-size:14px}ol li{margin-bottom:8px}.item{border-bottom:1px solid #2e2e2e;padding:20px 0}.item a{color:#fff;font-size:18px;font-weight:700;text-decoration:none}.item a:hover{color:#ffe600}.item .date{color:#888;font-size:13px;margin-top:6px}.home{display:inline-block;margin-top:30px;color:#ffe600;text-decoration:none;font-weight:700}
</style>
</head>
<body><div class="wrap">
<h1>HIPHOP 中文站 · RSS 订阅</h1>
<p class="sub">这是本站的 RSS 订阅源，更新文章会自动推送到你的阅读器。</p>
<div class="box">
<h2>怎么用？</h2>
<p>复制下面这个地址，粘贴到你用的 RSS 阅读器里：</p>
<div class="url">https://hiphopnote.com/index.xml</div>
<ol>
<li>打开你的 RSS 阅读器 App</li>
<li>点「添加订阅 / Add Feed」</li>
<li>粘贴上面这个地址，确认即可</li>
</ol>
<p>之后本站每发新文章，阅读器都会自动收到，不用再来网站翻。</p>
</div>
<h2>最新文章</h2>
<xsl:for-each select="rss/channel/item">
<div class="item">
<a href="{link}"><xsl:value-of select="title"/></a>
<div class="date"><xsl:value-of select="pubDate"/></div>
</div>
</xsl:for-each>
<a class="home" href="/">← 回到首页</a>
</div></body></html>
</xsl:template>
</xsl:stylesheet>
