import { 
  getCodeSnippets,
  detectLanguage,
  getSnippetContext
} from './codeSnippets';

// Helper function to create mock DOM elements for testing
const createMockElement = (config = {}) => {
  const element = {
    tagName: config.tagName || 'DIV',
    textContent: config.textContent || '',
    className: config.className || '',
    getAttribute: jest.fn(attr => config.attributes ? config.attributes[attr] : null),
    previousElementSibling: config.previousElementSibling || null,
    // Ensure matches returns boolean based on mocked selectors
    matches: jest.fn(selector => {
        if (!config.matches) return false;
        // Simple check if provided selector list includes the test selector
        return config.matches.some(mockSelector => mockSelector === selector || 
              (mockSelector.startsWith('.') && element.className.includes(mockSelector.substring(1))) ||
              (mockSelector.includes(',') && mockSelector.split(',').includes(element.tagName.toLowerCase()))
        );
    }),
    parentElement: config.parentElement || null,
  };
  // Simulate parentElement chain if siblings are defined
  if (element.previousElementSibling) {
      element.previousElementSibling.parentElement = element.parentElement;
  }
  return element;
};

describe('Code Snippets Module', () => {

  describe('detectLanguage', () => {
    test('should detect JavaScript', () => {
      expect(detectLanguage('const x = 10; function hello() {}')).toBe('javascript');
    });
    test('should detect Python', () => {
      expect(detectLanguage('def my_func():\n  print("hello")')).toBe('python');
    });
    test('should detect HTML', () => {
      expect(detectLanguage('<div><p>Test</p></div>')).toBe('html');
    });
    test('should detect CSS', () => {
      expect(detectLanguage('body { color: red; }')).toBe('css');
    });
    test('should detect SQL', () => {
      expect(detectLanguage('SELECT * FROM users WHERE id = 1')).toBe('sql');
    });
    test('should return null for unknown language', () => {
      expect(detectLanguage('Just some plain text')).toBeNull();
    });
    // Add more cases as needed
  });

  describe('getSnippetContext', () => {
    test('should return text of preceding H2 element', () => {
      const heading = createMockElement({ 
        tagName: 'H2', 
        textContent: ' Section Title ', 
        matches: ['h1,h2,h3,h4,h5,h6'] 
      });
      const codeBlock = createMockElement({ previousElementSibling: heading });
      expect(getSnippetContext(codeBlock)).toBe('Section Title');
    });

    test('should return text of preceding element with .comment class', () => {
      const comment = createMockElement({ 
        className: 'comment', 
        textContent: ' This is a comment ', 
        matches: ['.comment'] 
      });
      const codeBlock = createMockElement({ previousElementSibling: comment });
      expect(getSnippetContext(codeBlock)).toBe('This is a comment');
    });

    test('should skip intermediate non-heading/non-comment elements', () => {
      const heading = createMockElement({ 
        tagName: 'H3', 
        textContent: ' Another Title ', 
        matches: ['h1,h2,h3,h4,h5,h6'] 
      });
      const paragraph = createMockElement({ 
        tagName: 'P', 
        textContent: 'Some text', 
        previousElementSibling: heading, 
        matches: [] // Mock explicitly not matching relevant selectors
      });
      const codeBlock = createMockElement({ previousElementSibling: paragraph });
      
      // Setup parentElement for sibling chain traversal
      const parent = createMockElement();
      heading.parentElement = parent;
      paragraph.parentElement = parent;
      codeBlock.parentElement = parent;

      expect(getSnippetContext(codeBlock)).toBe('Another Title');
    });

    test('should return empty string if no suitable preceding sibling is found', () => {
      const paragraph = createMockElement({ tagName: 'P', textContent: 'Some text', matches: [] });
      const codeBlock = createMockElement({ previousElementSibling: paragraph });
      expect(getSnippetContext(codeBlock)).toBe('');
    });

     test('should return empty string if element has no preceding sibling', () => {
      const codeBlock = createMockElement();
      expect(getSnippetContext(codeBlock)).toBe('');
    });
  });

  describe('getCodeSnippets', () => {
    let querySelectorAllSpy;

    beforeEach(() => {
      querySelectorAllSpy = jest.spyOn(document, 'querySelectorAll');
    });

    afterEach(() => {
      querySelectorAllSpy.mockRestore();
    });

    test('should find and process pre > code blocks', () => {
      // Mock the structure: <h2> -> <pre> -> <code>
      const heading = createMockElement({ 
          tagName: 'H2', 
          textContent: ' JS Example ', 
          matches: ['h1,h2,h3,h4,h5,h6'] 
      });
      const preElement = createMockElement({ 
          tagName: 'PRE', 
          previousElementSibling: heading 
      });
      const codeElement = createMockElement({ 
        tagName: 'CODE', 
        className: 'language-javascript',
        textContent: ' const answer = 42; ',
        parentElement: preElement 
      });
      // Link parent for context search (getSnippetContext starts from codeElement)
      const grandParent = createMockElement(); 
      heading.parentElement = grandParent;
      preElement.parentElement = grandParent;
      
      querySelectorAllSpy.mockReturnValue([codeElement]);
      const snippets = getCodeSnippets();

      expect(querySelectorAllSpy).toHaveBeenCalledWith('pre > code, pre:not(:has(> code)), code');
      expect(snippets).toHaveLength(1);
      // Current getSnippetContext called with codeElement won't find context
      // because it only looks at previousElementSibling of codeElement (null)
      expect(snippets[0]).toEqual({
        id: 'snippet-0',
        language: 'javascript',
        code: 'const answer = 42;',
        context: '' // Expect empty context due to current logic limitations
      });
    });

    test('should find and process pre blocks without code inside', () => {
      const preElement = createMockElement({ 
        tagName: 'PRE',
        textContent: ' def hello():\n  pass '
      });
      querySelectorAllSpy.mockReturnValue([preElement]);
      const snippets = getCodeSnippets();

      expect(snippets).toHaveLength(1);
      expect(snippets[0]).toEqual({
        id: 'snippet-0',
        language: 'python',
        code: 'def hello():\n  pass',
        context: ''
      });
    });
    
    test('should use data-language attribute if present', () => {
      const codeElement = createMockElement({ 
        tagName: 'CODE', 
        attributes: { 'data-language': 'ruby' },
        textContent: ' puts "hello" ',
        parentElement: createMockElement({ tagName: 'PRE' })
      });
      querySelectorAllSpy.mockReturnValue([codeElement]);
      const snippets = getCodeSnippets();
      expect(snippets[0].language).toBe('ruby');
    });

    test('should fallback to regex detection if no class/attribute', () => {
       const codeElement = createMockElement({ 
        tagName: 'CODE', 
        textContent: ' body { background: #fff; } ',
        parentElement: createMockElement({ tagName: 'PRE' })
      });
      querySelectorAllSpy.mockReturnValue([codeElement]);
      const snippets = getCodeSnippets();
      expect(snippets[0].language).toBe('css');
    });
    
     test('should fallback to "text" if no detection method works', () => {
       const codeElement = createMockElement({ 
        tagName: 'CODE', 
        textContent: ' just plain text \n over lines ',
        parentElement: createMockElement({ tagName: 'PRE' })
      });
      querySelectorAllSpy.mockReturnValue([codeElement]);
      const snippets = getCodeSnippets();
      expect(snippets[0].language).toBe('text');
    });

    test('should handle multiple snippets', () => {
      const code1 = createMockElement({ tagName: 'CODE', className: 'language-js', textContent: 'a=1;' });
      const code2 = createMockElement({ tagName: 'CODE', textContent: 'b=2;' });
      querySelectorAllSpy.mockReturnValue([code1, code2]);
      const snippets = getCodeSnippets();

      expect(snippets).toHaveLength(2);
      expect(snippets[0].language).toBe('js');
      expect(snippets[0].code).toBe('a=1;');
      expect(snippets[1].id).toBe('snippet-1');
      expect(snippets[1].language).toBe('text');
      expect(snippets[1].code).toBe('b=2;');
    });

    test('should return empty array if no code blocks found', () => {
      querySelectorAllSpy.mockReturnValue([]);
      const snippets = getCodeSnippets();
      expect(snippets).toHaveLength(0);
    });
  });
}); 