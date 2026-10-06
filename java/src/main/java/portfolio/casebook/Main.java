package portfolio.casebook;

import java.nio.file.Path;
import java.util.Map;

/** Print a case's estimates: {@code java portfolio.casebook.Main <cases-dir> <id>}. */
public final class Main {
    private Main() {
    }

    /** Entry point. */
    public static void main(String[] args) throws Exception {
        if (args.length != 2) {
            System.err.println("usage: Main <cases-dir> <case-id>");
            System.exit(2);
        }
        CaseModel model;
        Map<String, Double> values;
        try {
            model = CaseModel.load(Path.of(args[0]), args[1]);
            values = model.compute(Map.of());
        } catch (IllegalArgumentException | Formula.FormulaException e) {
            System.err.println("error: " + e.getMessage());
            System.exit(2);
            return;
        }
        System.out.println(model.title());
        for (CaseModel.Derived d : model.derived()) {
            System.out.printf("  %-58s %,.4g %s%n", d.label(), values.get(d.name()), d.unit());
        }
    }
}
