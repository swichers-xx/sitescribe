/* @license Readability.js (c) Mozilla
 * Version: 0.4.2
 * Source: https://github.com/mozilla/readability */
(function(global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global = global || self, global.Readability = factory());
}(this, function() {
	function Readability(doc) {
		this._doc = doc;
	}

	Readability.prototype.parse = function() {
		const article = this._doc.querySelector('article') || this._doc.body;
		if (!article) return null;

		// Get the main content
		const content = this._getContent(article);
		const title = this._getTitle();

		return {
			title: title,
			textContent: content,
			length: content.length
		};
	};

	Readability.prototype._getTitle = function() {
		let title = '';
		const elements = [
			'h1',
			'meta[property="og:title"]',
			'meta[name="twitter:title"]',
			'title'
		];

		for (const selector of elements) {
			const element = this._doc.querySelector(selector);
			if (element) {
				title = selector === 'title' ? element.textContent : element.getAttribute('content');
				if (title) break;
			}
		}

		return title.trim();
	};

	Readability.prototype._getContent = function(article) {
		// Remove unwanted elements
		const unwanted = [
			'script',
			'style',
			'iframe',
			'form',
			'button',
			'input',
			'nav',
			'header',
			'footer'
		];

		unwanted.forEach(tag => {
			const elements = article.getElementsByTagName(tag);
			while (elements.length > 0) elements[0].remove();
		});

		// Get all paragraphs and headings
		const content = [];
		const elements = article.querySelectorAll('p, h1, h2, h3, h4, h5, h6');
		elements.forEach(element => {
			const text = element.textContent.trim();
			if (text) content.push(text);
		});

		return content.join('\n\n');
	};

	return Readability;
}));