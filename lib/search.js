// Search and indexing functionality
class ContentIndex {
	constructor() {
		this.index = new Map();
		this.metadata = new Map();
	}

	// Add content to the index
	async addContent(url, content, metadata) {
		const terms = this.tokenize(content);
		const docId = this.generateId(url);
		
		// Store terms with positions
		terms.forEach((term, position) => {
			if (!this.index.has(term)) {
				this.index.set(term, new Map());
			}
			if (!this.index.get(term).has(docId)) {
				this.index.get(term).set(docId, []);
			}
			this.index.get(term).get(docId).push(position);
		});

		// Store metadata
		this.metadata.set(docId, {
			url,
			title: metadata.title,
			timestamp: metadata.captureTime,
			snippets: this.generateSnippets(terms, content)
		});

		await this.persistIndex();
	}

	// Search the index
	async search(query, options = {}) {
		const terms = this.tokenize(query);
		const results = new Map();

		terms.forEach(term => {
			const docs = this.index.get(term) || new Map();
			docs.forEach((positions, docId) => {
				if (!results.has(docId)) {
					results.set(docId, {
						score: 0,
						positions: []
					});
				}
				results.get(docId).score += positions.length;
				results.get(docId).positions.push(...positions);
			});
		});

		// Sort and format results
		return Array.from(results.entries())
			.map(([docId, data]) => ({
				...this.metadata.get(docId),
				score: data.score,
				snippets: this.getMatchingSnippets(docId, terms)
			}))
			.sort((a, b) => b.score - a.score)
			.slice(0, options.limit || 10);
	}

	// Helper methods
	tokenize(text) {
		return text.toLowerCase()
			.replace(/[^\w\s]/g, ' ')
			.split(/\s+/)
			.filter(term => term.length > 2);
	}

	generateId(url) {
		return btoa(url).replace(/[^a-zA-Z0-9]/g, '');
	}

	generateSnippets(terms, content) {
		const snippets = [];
		const sentences = content.split(/[.!?]+/);
		
		sentences.forEach(sentence => {
			const sentenceTerms = this.tokenize(sentence);
			if (terms.some(term => sentenceTerms.includes(term))) {
				snippets.push(sentence.trim());
			}
		});

		return snippets;
	}

	getMatchingSnippets(docId, searchTerms) {
		return this.metadata.get(docId).snippets
			.filter(snippet => 
				searchTerms.some(term => 
					this.tokenize(snippet).includes(term)
				)
			);
	}

	// Persistence methods
	async persistIndex() {
		const data = {
			index: Array.from(this.index.entries()),
			metadata: Array.from(this.metadata.entries())
		};
		await chrome.storage.local.set({ searchIndex: data });
	}

	async loadIndex() {
		const { searchIndex } = await chrome.storage.local.get('searchIndex');
		if (searchIndex) {
			this.index = new Map(searchIndex.index);
			this.metadata = new Map(searchIndex.metadata);
		}
	}
}

// Export for use in other modules
export const contentIndex = new ContentIndex();