/*

== Чат с передачей файлов ==

Использует элементы страницы:

* #files - список файлов пользователя
* #roster - список участников чата
* #chat - список сообщений в чате
* #login - кнопка входа в чат
* #name - поле воода имени пользователя
* #message - поле ввода сообщения пользователя
* #send - кнопка отправки сообщения
* #file - кнопка публикации локального файла

Структура сообщений:

* from - ID отправителя
* to - ID получателя или all
* time - время транзакции сообщения
* type - тип сообщения
* content - содержимое, строка или структура, зависит от типа сообщения

Типы сообщений:

* connect - новый клиент подключен, пустое содержимое, генерируется сервером
* disconnect - клиент отключен, пустое содержимое, генерируется сервером
* message - сообщение чата от клиента, содержимое - строка сообщения
* leave - сигнал выхода клиента из чата, пустое содержимое, передача файлов все ещё возможна
* enter - сигнал входа клиента в чат, содержит имя клиента
* hello - приветствие вошедшего клиента в чате, содержит имя приветвующего
* file - публикация файла в чате, содержит структуру:
	* uuid - идентификатор файла
	* name - имя файла
	* size - размер файла в байтах
* search - сигнал поиска источника файла, содержит структуру:
	* uuid - идентификатор файла
	* session - идентификатор соединения клиент-клиент
	* sdp - offer для WebRTC
	* ice - кондидат подключения
* find - сигнал ответа источника файла, содержит структуру:
	* uuid - идентификатор файла
	* session - идентификатор соединения клиент-клиент
	* sdp - answer для WebRTC
	* ice - кондидат подключения

После установки RTCDataChannel offer ожидает сообщение с контентом файла, после чего разрывает соединение.

*/
'use strict'; jQuery(function ($) {
	
	/**
	 * Генерация UUID по ISO
	 * @returns {string} UUID
	 */
	var generateUUID = function () {
		var d = new Date().getTime();
		if (window.performance && typeof window.performance.now === 'function') {
			d += window.performance.now();
		}
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
			var r = (d + Math.random() * 16) % 16 | 0;
			d = Math.floor(d / 16);
			return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
		});
	};
	
	/**
	 * Обработчик ошибок
	 * @callback onError
	 * @param {string} error Текст сообщения об ошибке
	 */
	/**
	 * Канал связи WebRTC
	 * @param {string} session UUID сессии, одинаковая для обоих участников
	 * @param {Channels} channels Менеджер управления каналами
	 * @param {onError} onError Обработчик ошибок канала связи
	 * @constructor
	 */
	var Channel = function (session, channels, onError) {
		/**
		 * Возвращает связанную сессию
		 * @returns {string}
		 */
		this.getSession = function () {
			return session;
		};
		var ice = false;
		var sdp = false;
		var onReady = false;
		var checkReady = function () {
			if (ice && sdp && onReady) {
				onReady({
					session: session,
					ice: ice,
					sdp: sdp
				});
			}
		};
		var peerConnection = new RTCPeerConnection(this.settings.config, this.settings.constrains);
		peerConnection.onicecandidate = function (event) {
			if (event.candidate) {
				ice = event.candidate;
				checkReady();
			}
		};
		var channel = false;
		/**
		 * Принудительное закрытие канала
		 */
		this.remove = function () {
			if (channel) {
				channel.close();
				channel = false;
			}
		};
		/**
		 * Обработчик готовности Offer
		 * @callback offerOnReady
		 * @param {Object} offer
		 * @param {string} offer.session Идентификатор сессии соединения
		 * @param {Object} offer.ice
		 * @param {Object} offer.sdp
		 */
		/**
		 * Генерация Offer
		 * @param {offerOnReady} offerOnReady Обработчик готовности Offer
		 */
		this.offer = function (offerOnReady) {
			onReady = offerOnReady;
			channel = peerConnection.createDataChannel(this.settings.name, this.settings.channel);
			channel.binaryType = 'blob';
			channel.onclose = function () {
				channels.remove(session);
			};
			peerConnection.createOffer(function (offer) {
				peerConnection.setLocalDescription(offer, function () {
					sdp = offer;
					checkReady();
				}, onError);
			}, onError);
		};
		/**
		 * Обработчик готовности Answer
		 * @callback answerOnReady
		 * @param {Object} offer
		 * @param {string} offer.session Идентификатор сессии соединения
		 * @param {Object} offer.ice
		 * @param {Object} offer.sdp
		 */
		/**
		 * Обработчик Обработчик открытия канала
		 * @callback onOpen
		 * @param {Object} chanel
		 */
		/**
		 * Генерация Answer
		 * @param {Object} search Структура Offer
		 * @param {Object} search.ice
		 * @param {Object} search.sdp
		 * @param {answerOnReady} answerOnReady Обработчик готовности Answer
		 * @param {onOpen} onOpen Обработчик открытия канала
		 */
		this.answer = function (search, answerOnReady, onOpen) {
			onReady = answerOnReady;
			peerConnection.ondatachannel = function (event) {
				if (event.channel) {
					channel = event.channel;
					channel.binaryType = 'blob';
					channel.onclose = function () {
						channels.remove(session);
					};
					channel.onopen = function () {
						onOpen(channel);
					};
				}
			};
			peerConnection.setRemoteDescription(new RTCSessionDescription(search.sdp), function () {
				if (peerConnection.remoteDescription.type == 'offer') {
					peerConnection.createAnswer(function (answer) {
						peerConnection.setLocalDescription(answer, function () {
							sdp = answer;
							checkReady();
						}, onError);
					}, onError);
				}
			}, onError);
			peerConnection.addIceCandidate(new RTCIceCandidate(search.ice));
		};
		/**
		 * Обработчик приема сообщения на канале
		 * @callback onMessage
		 * @param {Blob} data Контент сообщения
		 */
		/**
		 * Установка Answer для Offer
		 * @param {Object} search Структура Answer
		 * @param {Object} search.ice
		 * @param {Object} search.sdp
		 * @param {onMessage} onMessage Обработчик приема сообщения на канале
		 */
		this.connect = function (search, onMessage) {
			channel.onmessage = function (event) {
				onMessage(event.data);
			};
			peerConnection.setRemoteDescription(new RTCSessionDescription(search.sdp), function () {}, onError);
			peerConnection.addIceCandidate(new RTCIceCandidate(search.ice));
		};
	};
	Channel.prototype = {
		/**
		 * Настройки WebRTC: разрешены каналы данных, используется UDP
		 */
		settings: {
			config: {iceServers: [/*{urls: ['stun:stun.1.google.com:19302', 'stun:23.21.150.121']}*/]},
			constrains: {options: [{DtlsSrtpKeyAgreement: true}, {RtpDataChannels: true}]},
			name: 'RTCDataChannel',
			channel: {reliable: false}
		}
	};
	
	/**
	 * Набор активных сессий каналов WebRTC
	 * @constructor
	 */
	var Channels = function () {
		var channels = {};
		
		/**
		 * Добавление нового канала
		 * @param {string} session Идентификатор новой сесиии
		 * @param {onError} onError Обработчик ошибок на канале
		 * @returns {Channel}
		 */
		this.append = function (session, onError) {
			var channel = new Channel(session, this, onError);
			channels[session] = channel;
			return channel;
		};
		/**
		 * Удаляет сессию и закрывает канал
		 * @param {string} session Идентификатор сесиии
		 */
		this.remove = function (session) {
			if (channels[session]) {
				var channel = channels[session];
				delete channels[session];
				channel.remove();
			}
		};
		/**
		 * Возвращает канал по сессии или false если такой сессии нет
		 * @param {string} session Идентификатор сесиии
		 * @returns {Channel|bool}
		 */
		this.find = function (session) {
			return (channels[session]) ? channels[session] : false;
		};
	};
	
	/**
	 * Обработчик публикаии файла в чате
	 * @callback doShare
	 * @param {Object} share
	 * @param {string} share.uuid Идентификатор файла
	 * @param {string} share.name Имя файла
	 * @param {int} share.size Размер файла в байтах
	 */
	/**
	 * Виджет файла пользователя
	 * @param {string} uuid Идентификатор файла
	 * @param {Files} files Набор файлов пользователя
	 * @param {Channels} channels Набор каналов передачи данных
	 * @param {doShare} doShare Обработчик публикаии файла в чате
	 * @constructor
	 */
	var File = function (uuid, files, channels, doShare) {
		var content = false;
		var self = this;
		var name, size;
		/**
		 * Отображение файла объектом jQuery
		 * @type {Object}
		 */
		this.$self = $('<li>').attr('class', 'list-group-item').attr('data-uuid', uuid).append(
			$('<p>').attr('class', 'file-info').text('...')
		).append(
			$('<span>').attr('class', 'badge pull-fight file-state').text('Empty')
		).append(
			$('<span>').attr('class', 'btn-group btn-group-sm').append(
				$('<button>').attr('class', 'btn btn-default file-remove').attr('title', 'Remove').click(function (event) {
					event.preventDefault();
					files.remove(uuid);
				}).append(
					$('<span>').attr('class', 'glyphicon glyphicon-remove').attr('aria-hidden', 'true')
				).append(
					$('<span>').attr('class', 'sr-only').text('Remove')
				)
			).append(
				$('<button>').attr('class', 'btn btn-default file-share disabled').attr('title', 'Share').attr('disabled', 'disabled').click(function (event) {
					event.preventDefault();
					if (content) {
						doShare({
							uuid: uuid,
							name: name,
							size: size
						});
					}
				}).append(
					$('<span>').attr('class', 'glyphicon glyphicon-share').attr('aria-hidden', 'true')
				).append(
					$('<span>').attr('class', 'sr-only').text('Save')
				)
			).append(
				$('<button>').attr('class', 'btn btn-default file-save disabled').attr('title', 'Save').attr('disabled', 'disabled').click(function (event) {
					event.preventDefault();
					if (content) {
						var a = document.createElement('a');
						a.setAttribute('href', window.URL.createObjectURL(content));
						a.setAttribute('download', name);
						a.style.display = 'none';
						document.body.appendChild(a);
						a.click();
						document.body.removeChild(a);
					}
				}).append(
					$('<span>').attr('class', 'glyphicon glyphicon-floppy-disk').attr('aria-hidden', 'true')
				).append(
					$('<span>').attr('class', 'sr-only').text('Save')
				)
			)
		);
		/**
		 * Удаляет виджет файла и контент из пямяти
		 */
		this.remove = function () {
			this.$self.remove();
			content = false;
		};
		var setState = function (state) {
			self.$self.find('.file-state').text(state);
		};
		var setInfo = function (newName, newSize) {
			name = newName;
			size = newSize;
			self.$self.find('.file-save').attr('data-name', name);
			self.$self.find('.file-info').text(name + ' (' + Math.ceil(size / 1024) + ' KB)');
		};
		/**
		 * Возвращает идентификатор файла
		 * @returns {string}
		 */
		this.getUuid = function () {
			return uuid;
		};
		var setError = function (error) {
			setState(error);
			self.$self.attr('data-uuid', null);
			self.$self.removeClass('list-group-item-info');
			self.$self.addClass('list-group-item-danger');
		};
		var setContent = function (result) {
			if (result) {
				content = result;
				self.$self.find('.file-save').removeClass('disabled').attr('disabled', null);
				self.$self.removeClass('list-group-item-info');
				self.$self.removeClass('list-group-item-danger');
				self.$self.addClass('list-group-item-success');
				self.$self.find('.file-share').removeClass('disabled').attr('disabled', null);
			}
		};
		/**
		 * Обработчик завершения загрузки локального файла
		 * @callback onLoad
		 */
		/**
		 * Загрузка локального файла
		 * @param {window.File} file Объект выбранного файла
		 * @param {onLoad} onLoad Обработчик завершения загрузки файла
		 */
		this.fromLocal = function (file, onLoad) {
			setInfo(file.name, file.size);
			setContent(file);
			setState('Ready');
			onLoad();
		};
		/**
		 * Инициализация загрузки удаленного файла (Offer)
		 * @param {Object} file
		 * @param {string} file.name Имя загружаемого файла
		 * @param {int} file.size Размер загружаемого файла в байтах
		 * @param {offerOnReady} doSearch Метод поиска удаленного файла
		 */
		this.initDownloader = function (file, doSearch) {
			setState('Init');
			setInfo(file.name, file.size);
			var session = generateUUID();
			channels.append(session, function (error) {
				setError(error);
				channels.remove(session);
			}).offer(function (search) {
				setState('Search');
				doSearch(search);
			});
		};
		/**
		 * Инициализация выгрузки локального файла (Answer)
		 * @param {Object} search Структура Offer
		 * @param {string} search.session Идентификатор инициализированной сессии
		 * @param {Object} search.ice
		 * @param {Object} search.sdp
		 * @param {answerOnReady} doFind Метод подтверждения наличия файла
		 */
		this.initUploader = function (search, doFind) {
			channels.append(search.session, function (error) {
				setError(error);
				channels.remove(search.session);
			}).answer(search, doFind, function (stream) {
				stream.send(content);
			});
		};
		/**
		 * Получение удаленного файла
		 * @param {Object} search Структура Answer
		 * @param {string} search.session Идентификатор инициализированной сессии
		 * @param {Object} search.ice
		 * @param {Object} search.sdp
		 */
		this.fromRemote = function (search) {
			setState('Upload');
			self.$self.addClass('list-group-item-info');
			var channel = channels.find(search.session);
			if (channel) channel.connect(search, function (data) {
				setState('Ready');
				setContent(data);
				channels.remove(search.session);
			});
		};
	};
	
	/**
	 * Набор пользовательских файлов
	 * @param {Object} $self Контейнер виджетов файлов, объект jQuery
	 * @param {Channels} channels Набор каналов передачи данных
	 * @param {doShare} doShare Обработчик публикации файла в чате
	 * @constructor
	 */
	var Files = function ($self, $file, channels, doShare) {
		var self = this;
		this.$self = $self;
		$file.change(function (event) {
			event.preventDefault();
			for (var index = 0, localFile; localFile = event.target.files[index]; index++) {
				(function (localFile) {
					var file = self.append();
					file.fromLocal(localFile, function () {
						doShare({
							uuid: file.getUuid(),
							name: localFile.name,
							size: localFile.size
						});
					});
				})(localFile);
			}
		});
		var files = {};
		/**
		 * Добавление виджета файла
		 * @param {undefined|string} uuid Идентификатор файла, указывается для загружаемых файлов
		 * @returns {File}
		 */
		this.append = function (uuid) {
			uuid = (uuid) ? uuid : generateUUID();
			if (files[uuid]) {
				this.remove(uuid);
			}
			var file = new File(uuid, this, channels, doShare);
			this.$self.append(file.$self);
			files[uuid] = file;
			return file;
		};
		/**
		 * Удаляет виджет файла, вместе с его контентом в памяти
		 * @param {string} uuid Идентификатор файла
		 */
		this.remove = function (uuid) {
			if (files[uuid]) {
				files[uuid].remove();
				delete files[uuid];
			}
		};
		/**
		 * Возвращает виджет файла по его идентификатору или false если такого файла нет
		 * @param {string} uuid Идентификатор файла
		 * @returns {File|boolean}
		 */
		this.find = function (uuid) {
			return (files[uuid]) ? files[uuid] : false;
		};
	};
	
	/**
	 * Виджет ростера участников чата
	 * @param {Object} $self Элемент списка для ростера, объект jQuery
	 * @constructor
	 */
	var Roster = function ($self) {
		/**
		 * Элемент списка для ростера, объект jQuery
		 * @type {Object}
		 */
		this.$self = $self;
	};
	Roster.prototype = {
		/**
		 * Возвращает элемент списка (объект jQuery) по автору сообщения, или создает новый
		 * @param {Object} message
		 * @param {string} message.from Идентификатор участника чата
		 * @returns {Object}
		 */
		$getRecord: function (message) {
			var $record = this.$self.find('.list-group-item[data-id="' + message.from + '"]');
			if ($record.length == 0) {
				$record = $('<li>').addClass('list-group-item').attr('data-id', message.from).text('...');
				this.$self.append($record);
			}
			return $record;
		},
		/**
		 * Обновляет ростер используя сообщение от участника чата
		 * Для типов сообщений enter и hello - задаются имена участников
		 * Для типов сообщений leave и disconnect - удаляются записи из ростера
		 * @param {Object} message
		 * @param {string} message.from Идентификатор участника чата
		 * @param {string} message.type Тип ообщения
		 * @param {string|*} message.content Строка с именем пользователя или все что угодно
		 */
		update: function (message) {
			if (message.type == 'enter' || message.type == 'hello') {
				this.$getRecord(message).text(message.content);
			} else if (message.type == 'leave' || message.type == 'disconnect') {
				this.$getRecord(message).remove();
			}
		},
		/**
		 * Возвращает имя отправителя сообщения
		 * @param {Object} message
		 * @param {string} message.from Идентификатор участника чата
		 * @returns {string}
		 */
		getName: function (message) {
			var record = this.$getRecord(message);
			return (record.length == 0) ? message.from : record.text();
		},
		/**
		 * Очистка ростера
		 */
		clear: function () {
			this.$self.empty();
		}
	};
	
	/**
	 * Виджет сообщений чата
	 * @param {Object} $self Элемент списка для сообщений чата
	 * @param {Roster} roster Виджет ростера участников чата
	 * @param {Files} files Список виджетов файлов
	 * @constructor
	 */
	var Chat = function ($self, roster, files) {
		/**
		 * Элемент списка для сообщений чата
		 * @type {Object}
		 */
		this.$self = $self;
		/**
		 * Виджет ростера участников чата
		 * @type {Roster}
		 */
		this.roster = roster;
		/**
		 * Список виджетов файлов
		 * @type {Files}
		 */
		this.files = files;
		var isHover = false;
		this.$self.hover(function () {
			isHover = true;
		}, function () {
			isHover = false;
		});
		/**
		 * Прокрутка чата к последнему сообщению, если это возможно
		 */
		this.scrollDown = function () {
			if (!isHover) this.$self.parent().scrollTop(this.$self.height());
		};
	};
	Chat.prototype = {
		/**
		 * Добавление сообщения от участника чата о публикации файла (file)
		 * @param {Object} message
		 * @param {string} message.from Идентификатор отправителя сообщения
		 * @param {string} message.time Время транзита сообщения в UTC
		 * @param {Object} message.content
		 * @param {string} message.content.uuid Идентификатор файла
		 * @param {string} message.content.name Имя файла
		 * @param {string} message.content.size Размер файла в байтах
		 * @param doSearch
		 */
		addFile: function (message, doSearch) {
			var self = this;
			this.$self.append(
				$('<li>').attr('class', 'list-group-item').attr('data-time', message.time).append(
					$('<p>').append(
						$('<strong>').attr('data-from', message.from).text(this.roster.getName(message) + ': ')
					).append(
						$('<a>').prop('href', message.content.name).attr('data-uuid', message.content.uuid).text(message.content.name + ' (' + Math.ceil(message.content.size / 1024) + ' KB)').click(function (event) {
							event.preventDefault();
							var file = self.files.find(message.content.uuid);
							if (!file) doSearch(self.files.append(message.content.uuid));
						})
					)
				).append(
					$('<span>').addClass('badge').text(message.time)
				)
			);
			this.scrollDown();
		},
		/**
		 * Добавление сообщения от участника чата (message)
		 * @param {Object} message
		 * @param {string} message.from Идентификатор отправителя сообщения
		 * @param {string} message.time Время транзита сообщения в UTC
		 * @param {string} message.content Текст сообщения
		*/
		addMessage: function (message) {
			this.$self.append(
				$('<li>').attr('class', 'list-group-item').attr('data-time', message.time).append(
					$('<p>').append(
						$('<strong>').attr('data-from', message.from).text(this.roster.getName(message) + ': ')
					).append(
						document.createTextNode(message.content)
					)
				).append(
					$('<span>').addClass('badge').text(message.time)
				)
			);
			this.scrollDown();
		},
		/**
		 * Добавление сообщения от локального пользователя чата (message)
		 * @param {Object} message
		 * @param {string} message.from Имя пользоваеля
		 * @param {string} message.time Локальное время в UTC
		 * @param {string} message.content Текст сообщения
		 */
		selfMessage: function (message) {
			this.$self.append(
				$('<li>').attr('class', 'list-group-item list-group-item-info').attr('data-time', message.time).append(
					$('<p>').append(
						$('<strong>').text(message.from + ': ')
					).append(
						document.createTextNode(message.content)
					)
				).append(
					$('<span>').addClass('badge').text(message.time)
				)
			);
			this.scrollDown();
		},
		/**
		 * Очистка списка сообщений
		 */
		clear: function () {
			this.$self.empty();
		}
	};
	
	/**
	 * Виджет клиента чата
	 * @param {Object} $login Элемент кнопки входа/выхода, объект jQuery
	 * @param {Object} $name Элемент поля ввода имени пользователя, объект jQuery
	 * @param {Object} $message Элемент поля ввода сообщения, объект jQuery
	 * @param {Object} $send Элемент кнопки отправки сообщения, объект jQuery
	 * @param {Object} $files Элемент списка локальных файлов, объект jQuery
	 * @param {Object} $file Элемент кнопки выбора локального файла, объект jQuery
	 * @param {Object} $roster Элемент списка участников чата, объект jQuery
	 * @param {Object} $chat Элемент списка сообщений чата, объект jQuery
	 * @constructor
	 */
	var Login = function ($login, $name, $message, $send, $files, $file, $roster, $chat) {
		var socket = false;
		var share = function (info) {
			if (socket) socket.emit('message', {
				type: 'file',
				content: info
			});
		};
		var files = new Files($files, $file, new Channels(), share);
		var roster = new Roster($roster);
		var chat = new Chat($chat, roster, files);
		var leave = function () {
			if (socket) {
				socket.emit('message', {type: 'leave'});
				socket.close();
				socket = false;
			}
			roster.clear();
			chat.clear();
		};
		var getName = function () {
			return $name.val();
		};
		var getMessage = function () {
			return $message.val();
		};
		var enter = function () {
			socket = io();
			socket.on('message', function (message) {
				roster.update(message);
				var file = false;
				switch (message.type) {
					case 'enter': socket.emit('message', {
						type: 'hello',
						to: message.from,
						content: getName()
					}); break;
					case 'message': chat.addMessage(message); break;
					case 'file':
						chat.addFile(message, function (file) {
							file.initDownloader(message.content, function (channel) {
								socket.emit('message', {
									type: 'search',
									to: message.from,
									content: {
										uuid: message.content.uuid,
										session: channel.session,
										sdp: channel.sdp,
										ice: channel.ice
									}
								});
							});
						});
						break;
					case 'search':
						file = files.find(message.content.uuid);
						if (file) file.initUploader(message.content, function (channel) {
							socket.emit('message', {
								type: 'find',
								to: message.from,
								content: {
									uuid: message.content.uuid,
									session: channel.session,
									sdp: channel.sdp,
									ice: channel.ice
								}
							});
						});
						break;
					case 'find':
						file = files.find(message.content.uuid);
						if (file) file.fromRemote(message.content);
						break;
				}
			});
			socket.emit('message', {type: 'enter', content: getName()});
		};
		var send = function () {
			if (socket) {
				var message = {
					type: 'message',
					time: (new Date()).toISOString(),
					content: getMessage(),
					from: getName()
				};
				socket.emit('message', message);
				chat.selfMessage(message);
			}
		};
		var $glyphicon = $login.find('.glyphicon');
		$name.keydown(function (event) {
			if (event.keyCode == 13) {
				event.preventDefault();
				$login.click();
			}
		});
		$login.click(function (event) {
			event.preventDefault();
			if ($name.val()) {
				var altTitle = $login.attr('data-alt-title');
				var altClass = $glyphicon.attr('data-alt-class');
				$login.attr('data-alt-title', $login.attr('title'));
				$glyphicon.attr('data-alt-class', $glyphicon.attr('class'));
				$login.attr('title', altTitle);
				$glyphicon.attr('class', altClass);
				$login.find('.sr-only').text(altTitle);
				if ($name.attr('disabled')) {
					$name.attr('disabled', null);
					$name.removeClass('disabled');
					$message.attr('disabled', 'disabled');
					$message.addClass('disabled');
					$send.attr('disabled', 'disabled');
					$send.addClass('disabled');
					leave();
				} else {
					$name.attr('disabled', 'disabled');
					$name.addClass('disabled');
					$message.attr('disabled', null);
					$message.removeClass('disabled');
					$send.attr('disabled', null);
					$send.removeClass('disabled');
					enter();
				}
			}
		});
		$message.keydown(function (event) {
			if (event.keyCode == 13) {
				event.preventDefault();
				$send.click();
			}
		});
		$send.click(function (event) {
			event.preventDefault();
			if (!$send.attr('disabled') && $message.val()) {
				send();
				$message.val('');
			}
		});
	};
	
	// Инициализация чата
	new Login($('#login'), $('#name'), $('#message'), $('#send'), $('#files'), $('#file'), $('#roster'), $('#chat'));
	
});

