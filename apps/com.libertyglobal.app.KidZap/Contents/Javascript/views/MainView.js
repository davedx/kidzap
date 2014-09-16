var MainView = new MAF.Class({
	ClassName: 'MainView',

	Extends: MAF.system.SidebarView,

	data: [],
	channels: [],
	globalTimer: 0,

	initialize: function () {
		this.parent();

		// try get some data from Kraken
		var onBroadcastsReceived = function(data) {
			console.log(data);
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

		MAF.mediaplayer.init();
	},

	createView: function () {
		var view = this,
			room = view.room,
			clients = {}; // Keep track of the clients connected

		// Create a placeholder for the QRCode image
		var qrcode = new MAF.element.Image({
			styles: {
				vAlign: 'top',
				vOffset: 10,
				hOffset: 10,
				width: view.width - 20,
				height: view.width - 20
			}
		}).appendTo(view);

		(function (event) {
			var onData = function(data) {
				switch(data.command) {
					case "getGuide":
						var settings = {
							age: currentAppConfig.get("KidZap.Age"),
							time: currentAppConfig.get("KidZap.Time")
						};
						var payload = {data: view.data, settings: settings};
						log("Sending data: ", payload);
						room.send(payload);
						break;
					case "changeChannel":
						log("Changing channel to: "+data.ref);
						MAF.mediaplayer.setChannelByNumber(data.ref);
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
	}
});