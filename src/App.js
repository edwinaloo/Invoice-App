import React, { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [transactions, setTransactions] = useState(() => {
    const saved = localStorage.getItem("transactions");
    return saved ? JSON.parse(saved) : [];
  });

  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("income");

  // Save to localStorage when transactions change
  useEffect(() => {
    localStorage.setItem("transactions", JSON.stringify(transactions));
  }, [transactions]);

  const addTransaction = (e) => {
    e.preventDefault();
    if (!desc || !amount) return;

    const newTransaction = {
      id: Date.now(),
      desc,
      amount: parseFloat(amount),
      type,
    };

    setTransactions([...transactions, newTransaction]);
    setDesc("");
    setAmount("");
  };

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((acc, t) => acc + t.amount, 0);

  const balance = totalIncome - totalExpense;

  return (
    <div className="App">
      <h1>Budget Tracker</h1>

      <h3>Balance: ${balance.toFixed(2)}</h3>
      <p>Income: ${totalIncome.toFixed(2)} | Expense: ${totalExpense.toFixed(2)}</p>

      <form onSubmit={addTransaction}>
        <input
          type="text"
          placeholder="Description"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        <button type="submit">Add</button>
      </form>

      <ul>
        {transactions.map((t) => (
<li key={t.id} className={t.type}>
  {t.desc} - ${t.amount} ({t.type})
</li>

        ))}
      </ul>
    </div>
  );
}

export default App;
