var MainView = new MAF.Class({
	ClassName: 'MainView',

	Extends: MAF.system.FullscreenView,

	data: [],
	globalTimer: 0,

	initialize: function () {
		this.parent();

		// try get some data from Kraken
		var onBroadcastsReceived = function(data) {
			console.log("Received: ", data);
			this.data = data;
		}.bind(this);

		var nowDate = new Date().toISOString();
		nowDate = nowDate.substr(0, nowDate.lastIndexOf(':')) + 'Z';

		LGI.Guide.Broadcast.create()
						.limit(20)
						.fields(
								LGI.Guide.Broadcast.ID,
								LGI.Guide.Broadcast.TITLE,
								LGI.Guide.Broadcast.START,
								LGI.Guide.Broadcast.END,
								LGI.Guide.Broadcast.IMAGE_LINK,
								LGI.Guide.Broadcast.AGE_RATING,
								LGI.Guide.Broadcast.CHANNEL_NAME,
								"channel.ref",
								"channel.logicalPosition",
								LGI.Guide.Broadcast.SYNOPSIS)
						.filter(LGI.Guide.Broadcast.START.greaterThan(nowDate))
						.filter(LGI.Guide.Broadcast.CATEGORY.equalTo('kids'))
						.findOne(onBroadcastsReceived);

		var view = this;
		view.room = new MAF.PrivateRoom(view.ClassName);

		currentAppConfig.set("profiles", [{name: "thomas", active: true},{name: "linda", active: false}]);

		MAF.mediaplayer.init();
	},

	createView: function () {
		var view = this,
			room = view.room,
			clients = {}; // Keep track of the clients connected

		// Create a placeholder for the QRCode image
		// var backgroundimage = new MAF.element.Image({
		// 	styles: {
		// 		width: view.width,
		// 		height: view.height
		// 	},
		// 	source: "Images/qrbackground.png"
		// }).appendTo(view);

		var qrcode = new MAF.element.Image({
			styles: {
				vOffset: 600,
				hOffset: 95,
				width: 400,
				height: 400
			}
		}).appendTo(view);

		var instruction = "1. Scan QR Code with your Smartphone or Tablet" +
											"<br><br>2. Select settings for your kid(s)" +
											"<br><br>3. Let your kid(s) only watch what you want them to see";
		var instructions = new MAF.element.TextField({
			data: instruction,
			styles:{
				width: 800,
				height: 500,
				vOffset: 600,
				hOffset: 600,
				wrap: true,
				fontSize: 40
			}
		}).appendTo(view);

		var timeupContianer = new MAF.element.Container({
			styles:{
				width: view.width,
				height: view.height,
				backgroundColor: "#bf512e"
			}
		}).appendTo(view);
		timeupContianer.hide();

		var timeup = new MAF.element.Image({
			source: "Images/logo_big.png",
			styles: {
				vOffset: 248,
				hOffset: 532,
				width: 892,
				height: 420
			}
		}).appendTo(timeupContianer);

		var timeuptext = new MAF.element.TextField({
			data: "Your TV time is up!",
			styles:{
				width: 1200,
				height: 500,
				vOffset: 700,
				hOffset: 580,
				wrap: true,
				fontSize: 80
			}
		}).appendTo(timeupContianer);

		var exitButton = new MAF.control.TextButton({
			styles: {
				width: 500,
				height: 100,
				vOffset: 850,
				hOffset: 650,
				fontSize: 50,
				backgroundColor: "#772211"
			},
			theme: false,
			label: "EXIT",
			events: {
				onSelect: function() {
					MAF.application.exit();
				}
			}
		}).appendTo(timeupContianer);

		(function (event) {
			var onData = function(data) {
				//log("onData: ", data);
				if(!data.timestamp) return;
				var timestamp = data.timestamp;
				if(Date.now() - timestamp > 10000) return;

				switch(data.command) {
					case "getGuide":
						var settings = {
							age: currentAppConfig.get("KidZap.Age"),
							time: currentAppConfig.get("KidZap.Time")
						};
						var payload = {sent_command: data.command, data: view.data, settings: settings};
						log("Sending data: ", payload);
						room.send(payload);
						break;
					case "getProfiles":
						log("Getting profiles");
						//room.send({command: data.command, data: currentAppConfig.get("profiles")});
						break;
					case "changeChannel":
						log("Changing channel to: "+data.ref);
						MAF.mediaplayer.setChannelByNumber(data.ref);
						break;
					case "timeisup":
						log("Ohhnooo, time is up!");
						//MAF.mediaplayer.setChannelByNumber(data.ref);
						timeupContianer.show();
						break;
					case "changeSetting":
						log("Changing setting: ", data);
						currentAppConfig.set(data.name, data.value);
						break;
				}
			};
			var payload = event.payload;
			switch (event.type) {
				case 'onConnected':
					log('room connected');
					// If connected but room not joined make sure to join it automaticly
					if (!room.joined) room.join();
					return;
				case 'onDisconnected':
					clients = {}; // Reset clients
					log('connection lost waiting for reconnect and automaticly rejoin');
					return;
				case 'onCreated':
					// Create an url to the client application and pass the hash as querystring
					var url = widget.getUrl('Client/index.html?hash=' + payload.hash);
					qrcode.setSource(QRCode.get(url));
					log('room created', payload.hash, url);
					return;
				case 'onDestroyed':
					clients = {}; // Reset clients
					log('room destroyed', payload.hash);
					return;
				case 'onJoined':
					// If user is not the app then log the user
					if (payload.user !== room.user)
						log('user joined', payload.user);
					return;
				case 'onHasLeft':
					// If user is not the app then log the user
					if (payload.user !== room.user)
						log('user has left', payload.user);
					return;
				case 'onData':
					var data = payload.data;
					onData(data);
					break;
				default:
					log(event.type, payload);
					break;
			}
		}).subscribeTo(room, ['onConnected', 'onDisconnected', 'onCreated', 'onDestroyed', 'onJoined', 'onHasLeft', 'onData', 'onError']);

		// If Room socket is connected create and join room
		if (room.connected) room.join();			
	},

	updateView: function () {

	},

	destroyView: function() {
		var view = this;
		if (view.room) {
			view.room.leave(); // Leave room, will trigger an onLeaved of the app user
			view.room.destroy(); // Destroy the room
			delete view.room; // Unreference from view for GC
		}
		if(this.data) {
			delete this.data;
		}
	}
});