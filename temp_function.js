// Handle form submission for new stock entry
const handleSubmitStockEntry = async (e) => {
  e.preventDefault();
  setFormError("");

  // Validate form
  if (
    !newStockEntry.quantity ||
    !newStockEntry.purchasePrice ||
    !newStockEntry.purchaseDate
  ) {
    setFormError("All fields are required");
    return;
  }

  if (
    parseFloat(newStockEntry.quantity) <= 0 ||
    parseFloat(newStockEntry.purchasePrice) <= 0
  ) {
    setFormError("Quantity and purchase price must be greater than 0");
    return;
  }

  setIsSubmitting(true);

  try {
    // Get current stock entries
    const currentStockEntries = spare?.[stockField] || [];
    console.log("Current stock entries:", currentStockEntries);

    let updatedStockEntries;

    // Check if there's only one entry and it has zero quantity
    if (
      currentStockEntries.length === 1 &&
      isQuantityZero(currentStockEntries[0].quantity)
    ) {
      // Replace the zero quantity entry with the new entry
      updatedStockEntries = [
        {
          quantity: parseInt(newStockEntry.quantity),
          purchasePrice: parseFloat(newStockEntry.purchasePrice),
          purchaseDate: newStockEntry.purchaseDate,
        },
      ];
      console.log("Replaced single zero entry with new stock");
    } else {
      // Filter out zero quantity entries and add the new entry
      const filteredEntries = currentStockEntries.filter(
        (entry) => !isQuantityZero(entry.quantity)
      );
      updatedStockEntries = [
        ...filteredEntries,
        {
          quantity: parseInt(newStockEntry.quantity),
          purchasePrice: parseFloat(newStockEntry.purchasePrice),
          purchaseDate: newStockEntry.purchaseDate,
        },
      ];
      console.log("Filtered zero entries and added new stock");
    }

    console.log("Updated stock entries:", updatedStockEntries);

    // Update the spare with new stock entries
    const response = await fetch(`http://localhost:5000/api/spares/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        [stockField]: updatedStockEntries,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Error adding stock entry");
    }

    console.log("Stock entry successfully added to database");

    // Refresh spare details
    await fetchSpareDetails();
    console.log("Spare details refreshed");

    // Reset form
    setNewStockEntry({
      quantity: "",
      purchasePrice: "",
      purchaseDate: formatDate(new Date()),
    });

    setFormError("");
  } catch (err) {
    setFormError(err.message || "Error adding stock entry");
  } finally {
    setIsSubmitting(false);
  }
};
