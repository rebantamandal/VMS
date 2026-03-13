export const getDeleteDateAfterOneYear = (date) => {
  const deleteDate = new Date(date);
  deleteDate.setFullYear(deleteDate.getFullYear() + 1);
  return deleteDate;
};
