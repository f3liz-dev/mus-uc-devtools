// Example: Use script arguments
// Usage: ./mus-uc exec -f examples/js/with-args.js -a '["John", 42]'

const name = arguments[0] || "World";
const number = arguments[1] || 0;

return {
    greeting: `Hello, ${name}!`,
    doubled: number * 2,
    squared: number * number,
    timestamp: Date.now()
};
