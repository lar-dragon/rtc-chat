# ChatRTC

WebRTC text chat witch file transfer.

## WebRTC chat

- Node.js server
- Web client

The signaling part is done with [socket.io](socket.io).

## Install

It requires [node.js](http://nodejs.org/download/)

* git clone https://github.com/laraan/ChatRTC.git
* cd ChatRTC/
* node server.js

The server will run on port 8080.
You can test it in the (Chrome or Firefox) browser at [localhost:8080](http://localhost:8080/).

## TODO

* Поддержка Chrome
* Безопасные идентификаторы для клиентов
* Контрольная сумма в качестве идентификатора файла
* Проверка целостности переданных данных
* Отслеживание разрыва WebRTC соединения, выброс ошибки если связь потерена
* Таймаут для поиска файла, выброс ошибки если файл все ещё не найден
* Отслеживание потери WebSocket на клиенте, требуется перезапуск без потери сессии
* Кнопка повторной попытки загрузки файла при ошибке
* Перенести виджеты файлов в ленту сообщений
* Разделение типов сообщений на уровне WebSoccet
* Хранение истории на сервере
* Хранение ростера на сервере
* Поиск файлов у клиентов на стороне сервера
* Авторизация клиентов по OAuth (Google, Yandex)
* Автоматический деплой
* Локализация (RUS, ENG)
* Личные сообщения