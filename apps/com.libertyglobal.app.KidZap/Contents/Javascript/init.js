include('Javascript/views/MainView.js');

MAF.application.init({
	views: [
		{ id: 'view-MainView', viewClass: MainView },
		{ id: 'view-About', viewClass: MAF.views.AboutBox }
	],
	defaultViewId: 'view-MainView',
	settingsViewId: 'view-About'
});