const z = require('zod');
const { fromZodError } = require('zod-validation-error');

const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse({
        body: req.body,
        query: req.query,
        params: req.params,
    });

    if (result.success === false) {
        const formattedError = fromZodError(result.error).message;
        return res.status(400).json({ error: formattedError });
    }
    next();
};

module.exports = validate;
