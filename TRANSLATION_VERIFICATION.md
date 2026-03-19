# 翻译验证文档 / Translation Verification

## 支持的语言 / Supported Languages

本扩展现在支持以下7种语言：

1. 🇬🇧 **English (en)** - 英语
2. 🇩🇪 **German (de)** - 德语 (Deutsch)
3. 🇯🇵 **Japanese (ja)** - 日语 (日本語)
4. 🇨🇳 **Chinese (zh)** - 中文 (简体)
5. 🇷🇺 **Russian (ru)** - 俄语 (Русский)
6. 🇨🇿 **Czech (cs)** - 捷克语 (Čeština)
7. 🇰🇷 **Korean (ko)** - 韩语 (한국어)

## 关键翻译对比 / Key Translation Comparison

### 扩展名称 / Extension Name

| 语言 | 翻译 |
|------|------|
| English | Download Twitter & Pixiv Original Images |
| German | Twitter & Pixiv Original-Bilder herunterladen |
| Japanese | Twitter & Pixivのオリジナル画像をダウンロード |
| Chinese | 下载Twitter和Pixiv原图 |
| Russian | Загрузка оригинальных изображений Twitter & Pixiv |
| Czech | Stahování originálů obrázků Twitter & Pixiv |
| Korean | Twitter & Pixiv 원본 이미지 다운로드 |

### 弹出窗口标题 / Popup Title

| 语言 | 翻译 |
|------|------|
| English | Filename Format Settings |
| German | Dateinamen-Format-Einstellungen |
| Japanese | ファイル名形式の設定 |
| Chinese | 文件名格式设置 |
| Russian | Настройки формата имени файла |
| Czech | Nastavení formátu názvu souboru |
| Korean | 파일명 형식 설정 |

### 保存按钮 / Save Button

| 语言 | 翻译 |
|------|------|
| English | Save Settings |
| German | Einstellungen Speichern |
| Japanese | 設定を保存 |
| Chinese | 保存设置 |
| Russian | Сохранить настройки |
| Czech | Uložit nastavení |
| Korean | 설정 저장 |

### 成功消息 / Success Message

| 语言 | 翻译 |
|------|------|
| English | Successfully Saved! |
| German | Erfolgreich gespeichert! |
| Japanese | 正常に保存されました！ |
| Chinese | 保存成功！ |
| Russian | Успешно сохранено! |
| Czech | Úspěšně uloženo! |
| Korean | 성공적으로 저장되었습니다! |

## 测试方法 / Testing Methods

### 方法 1: 更改浏览器语言

1. 打开 Chrome 设置: `chrome://settings/languages`
2. 添加所需语言并移到顶部
3. 在 `chrome://extensions/` 重新加载扩展
4. 打开扩展弹窗查看翻译

### 方法 2: 命令行测试

```bash
# Mac
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --lang=ja

# Windows
"C:\Program Files\Google\Chrome\Application\chrome.exe" --lang=ja

# Linux
google-chrome --lang=ja
```

## 语言代码参考 / Language Code Reference

- `cs` - Czech (čeština) - 捷克语
- `de` - German (Deutsch) - 德语
- `en` - English - 英语
- `ja` - Japanese (日本語) - 日语
- `ko` - Korean (한국어) - 韩语
- `ru` - Russian (Русский) - 俄语
- `zh` - Chinese (中文) - 中文

## 翻译文件位置 / Translation Files Location

所有翻译文件位于: `_locales/[language_code]/messages.json`

例如:
- `_locales/ja/messages.json` - 日语翻译
- `_locales/ko/messages.json` - 韩语翻译
- `_locales/zh/messages.json` - 中文翻译
