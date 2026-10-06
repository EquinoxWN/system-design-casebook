package portfolio.casebook;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The same small formula language as the JavaScript calculator: numbers, names, + - * /,
 * parentheses and ceil, floor, round, min, max, log(x, base). Parsed, never evaluated as code.
 */
public final class Formula {
    private static final Pattern TOKEN =
            Pattern.compile("\\s*(?:(\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)|([a-z_][a-z0-9_]*)|([-+*/(),]))");
    private static final Map<String, Integer> ARITY =
            Map.of("ceil", 1, "floor", 1, "round", 1, "min", 2, "max", 2, "log", 2);

    /** Raised for a formula that cannot be parsed or evaluated. */
    public static final class FormulaException extends RuntimeException {
        private static final long serialVersionUID = 1L;

        FormulaException(String message, String formula) {
            super(message + " in formula: " + formula);
        }
    }

    private sealed interface Node permits Num, Name, Neg, Bin, Call {
    }

    private record Num(double value) implements Node {
    }

    private record Name(String name) implements Node {
    }

    private record Neg(Node arg) implements Node {
    }

    private record Bin(char op, Node left, Node right) implements Node {
    }

    private record Call(String fn, List<Node> args) implements Node {
    }

    private final String source;
    private final Node root;
    /** Longest formula accepted, so evaluation recursion stays shallow. */
    public static final int MAX_LENGTH = 2000;
    /** Deepest nesting of parentheses and unary minus accepted. */
    public static final int MAX_DEPTH = 100;

    private final List<String> tokens = new ArrayList<>();
    private int pos;
    private int depth;

    private Formula(String source) {
        this.source = source;
        if (source.length() > MAX_LENGTH) {
            throw new FormulaException("formula is longer than " + MAX_LENGTH + " characters",
                    source.substring(0, 40) + "...");
        }
        Matcher m = TOKEN.matcher(source);
        int at = 0;
        while (at < source.length() && !source.substring(at).isBlank()) {
            if (!m.find(at) || m.start() != at) {
                throw new FormulaException("unexpected character at " + at, source);
            }
            tokens.add(m.group(1) != null ? m.group(1) : m.group(2) != null ? m.group(2) : m.group(3));
            at = m.end();
        }
        root = expr();
        if (pos != tokens.size()) {
            throw new FormulaException("unexpected '" + tokens.get(pos) + "'", source);
        }
    }

    /** Parse a formula; throws FormulaException on syntax errors. */
    public static Formula parse(String source) {
        return new Formula(source);
    }

    /** Every name the formula refers to. */
    public Set<String> names() {
        Set<String> out = new TreeSet<>();
        collect(root, out);
        return out;
    }

    private static void collect(Node n, Set<String> out) {
        switch (n) {
            case Name name -> out.add(name.name());
            case Neg neg -> collect(neg.arg(), out);
            case Bin bin -> {
                collect(bin.left(), out);
                collect(bin.right(), out);
            }
            case Call call -> call.args().forEach(a -> collect(a, out));
            case Num num -> {
            }
        }
    }

    /** Evaluate with the given values; the result must be a finite number. */
    public double evaluate(Map<String, Double> env) {
        double v = eval(root, env);
        if (!Double.isFinite(v)) {
            throw new FormulaException("result is not a finite number", source);
        }
        return v;
    }

    private double eval(Node n, Map<String, Double> env) {
        return switch (n) {
            case Num num -> num.value();
            case Name name -> {
                Double v = env.get(name.name());
                if (v == null) {
                    throw new FormulaException("unknown name '" + name.name() + "'", source);
                }
                yield v;
            }
            case Neg neg -> -eval(neg.arg(), env);
            case Bin bin -> {
                double l = eval(bin.left(), env);
                double r = eval(bin.right(), env);
                if (bin.op() == '/' && r == 0) {
                    throw new FormulaException("division by zero", source);
                }
                yield switch (bin.op()) {
                    case '+' -> l + r;
                    case '-' -> l - r;
                    case '*' -> l * r;
                    default -> l / r;
                };
            }
            case Call call -> {
                double[] a = call.args().stream().mapToDouble(x -> eval(x, env)).toArray();
                yield switch (call.fn()) {
                    case "ceil" -> Math.ceil(a[0]);
                    case "floor" -> Math.floor(a[0]);
                    // JavaScript's Math.round rounds halves up; Java's does too for positive values.
                    case "round" -> (double) Math.round(a[0]);
                    case "min" -> Math.min(a[0], a[1]);
                    case "max" -> Math.max(a[0], a[1]);
                    default -> StrictMath.log(a[0]) / StrictMath.log(a[1]);
                };
            }
        };
    }

    private Node expr() {
        Node left = term();
        while ("+".equals(peek()) || "-".equals(peek())) {
            char op = next().charAt(0);
            left = new Bin(op, left, term());
        }
        return left;
    }

    private Node term() {
        Node left = unary();
        while ("*".equals(peek()) || "/".equals(peek())) {
            char op = next().charAt(0);
            left = new Bin(op, left, unary());
        }
        return left;
    }

    private Node unary() {
        if (++depth > MAX_DEPTH) {
            throw new FormulaException("nested more than " + MAX_DEPTH + " levels deep", source);
        }
        try {
            if ("-".equals(peek())) {
                next();
                return new Neg(unary());
            }
            return primary();
        } finally {
            depth--;
        }
    }

    private Node primary() {
        String t = next();
        if (t == null) {
            throw new FormulaException("unexpected end", source);
        }
        if (t.equals("(")) {
            Node inner = expr();
            expect(")");
            return inner;
        }
        if (Character.isDigit(t.charAt(0))) {
            return new Num(Double.parseDouble(t));
        }
        if (Character.isLetter(t.charAt(0)) || t.charAt(0) == '_') {
            if (!"(".equals(peek())) {
                return new Name(t);
            }
            next();
            List<Node> args = new ArrayList<>();
            if (!")".equals(peek())) {
                do {
                    args.add(expr());
                } while (",".equals(peek()) && next() != null);
            }
            expect(")");
            Integer arity = ARITY.get(t);
            if (arity == null) {
                throw new FormulaException("unknown function '" + t + "'", source);
            }
            if (arity != args.size()) {
                throw new FormulaException("'" + t + "' takes " + arity + " argument(s)", source);
            }
            return new Call(t, args);
        }
        throw new FormulaException("unexpected '" + t + "'", source);
    }

    private String peek() {
        return pos < tokens.size() ? tokens.get(pos) : null;
    }

    private String next() {
        return pos < tokens.size() ? tokens.get(pos++) : null;
    }

    private void expect(String t) {
        if (!t.equals(next())) {
            throw new FormulaException("expected '" + t + "'", source);
        }
    }
}
